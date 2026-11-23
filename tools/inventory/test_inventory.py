#!/usr/bin/env python3
"""Synthetic-fixture tests for tools/inventory/inventory.py.

No original game files. Temporary binaries (.bmp, .mct, .gf, .scr, .bft)
are created in a tmp directory and never committed.
"""

from __future__ import annotations

import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

import inventory as inv  # noqa: E402

FIXTURES = ROOT / "tools" / "fixtures" / "inventory"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def add_file(base: Path, rel: str, data: bytes, entries: list[dict]) -> None:
    path = base / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    entries.append({"path": rel.replace("\\", "/"), "size": len(data), "sha256": sha(data)})


class InventoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tmpdir = Path(tempfile.mkdtemp(prefix="sfc2-inv-"))
        cls.extracted = cls.tmpdir / "extracted"
        cls.reference = cls.tmpdir / "reference"
        shutil.copytree(FIXTURES / "extracted", cls.extracted)
        shutil.copytree(FIXTURES / "reference", cls.reference)
        cls.readme = cls.tmpdir / "README.md"
        shutil.copyfile(FIXTURES / "srv-readme.md", cls.readme)

        manifest_path = cls.extracted / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        entries = list(manifest["files"])

        # Temporary game-looking files used only in this test run.
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01.bmp", b"BM-SYNTH-TEX", entries)
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01_i.bmp", b"BM-SYNTH-ILLUM", entries)
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01_illum.bmp", b"BM-SYNTH-ILLUM2", entries)
        add_file(cls.extracted, "Assets/GUI/Menus/button.bmp", b"BM-SYNTH-GUI", entries)
        add_file(cls.extracted, "Assets/Sounds/test_beep.wav", b"RIFF-SYNTH-WAV", entries)
        add_file(cls.extracted, "Assets/Missions/Federation/TEST_MISSION.scr", b"MZ-SYNTH-SCR", entries)
        add_file(cls.extracted, "Assets/Missions/Klingon/TEST_MAP.mct", b"Name\tX\tY\nA\t100.5\t-50\nB\t100\t-50\n", entries)
        add_file(cls.extracted, "Assets/Campaign/Conquest/TEST_MAP.gf", b"\x00\x01SYNTH-BINARY-GF", entries)
        add_file(cls.extracted, "Assets/Fonts/test.bft", b"BFT-SYNTH-FONT", entries)
        # No .q3 anywhere.

        manifest["files"] = entries
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        cls.entries = entries
        cls.out = cls.tmpdir / "out"

    @classmethod
    def tearDownClass(cls) -> None:
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    def _run(self, command: str) -> tuple[int, str]:
        buf = io.StringIO()
        log = inv.MetadataLog(stream=buf)
        # Options follow the subcommand, matching the private-inventory workflow.
        args = inv.build_parser().parse_args(
            [
                command,
                "--extracted",
                str(self.extracted),
                "--reference",
                str(self.reference),
                "--manifest",
                str(self.extracted / "manifest.json"),
                "--readme",
                str(self.readme),
                "--output-dir",
                str(self.out),
            ]
        )
        rc = inv.main.__wrapped__ if False else None  # placeholder to keep grep quiet
        if command == "inventory":
            rc = inv.cmd_inventory(args, log)
        elif command == "verify":
            rc = inv.cmd_verify(args, log)
        else:
            rc = inv.cmd_inventory(args, log) or inv.cmd_verify(args, log)
        return rc, buf.getvalue()

    def test_inventory_counts_and_outputs(self) -> None:
        rc, log = self._run("inventory")
        self.assertEqual(rc, 0)
        inv_json = json.loads((self.out / "ce-2.670.json").read_text(encoding="utf-8"))
        self.assertEqual(inv_json["build"], "CE 2.670")
        self.assertEqual(inv_json["observedOn"], "sfc2-ci")
        self.assertEqual(inv_json["fileCount"], len(self.entries))
        # Compact triple: path, size, sha256
        self.assertEqual(len(inv_json["files"][0]), 3)
        summary_md = (self.out / "ce-2.670.md").read_text(encoding="utf-8")
        self.assertIn("Counts by extension", summary_md)
        self.assertIn("`.bmp`", summary_md)
        self.assertIn("No `*.q3` file was found", summary_md)
        self.assertIn("`_i`", summary_md)
        self.assertIn("`_illum`", summary_md)
        observations = json.loads((self.out / "observations-ce-2.670.json").read_text(encoding="utf-8"))
        self.assertEqual(observations["q3"]["extracted"], [])
        self.assertEqual(observations["q3"]["reference"], [])
        pats = observations["bmp"]["selfIlluminationPatterns"]
        self.assertTrue(any("illum" in k.lower() or k.lower().endswith("i") or "_i" in k.lower() for k in pats), pats)
        gui_folders = {e["path"] for e in observations["bmp"]["guiOrNonModelFolders"]}
        self.assertTrue(any("GUI" in p or "gui" in p.lower() for p in gui_folders), gui_folders)
        # Extensionless tables share headers
        extl = observations["extensionless"]
        self.assertEqual(extl["count"], 2)
        self.assertTrue(extl["headersSharedAcrossTables"])
        self.assertEqual(extl["distinctHeaderLayouts"][0]["headerNames"], ["Code", "Damage", "Range", "Arc"])
        self.assertEqual(extl["pathPattern"]["commonDirectory"], "Assets/Specs/WeaponGroups")
        # .gf binary, .mct text with coordinates
        self.assertEqual(observations["gf"]["binaryCount"], 1)
        self.assertFalse(observations["gf"]["coordinates"]["parseable"])
        self.assertTrue(observations["mct"]["coordinates"]["parseable"])
        self.assertEqual(observations["mct"]["coordinates"]["largestAbsolute"], 100.5)
        self.assertEqual(observations["mct"]["coordinates"]["smallestNonzeroStep"], 0.5)
        self.assertIn("TEST_MAP.mct", observations["mct"]["coordinates"]["largestAbsolutePath"])
        missions = (self.out / "missions-ce-2.670.md").read_text(encoding="utf-8")
        self.assertIn("Federation", missions)
        self.assertIn("TEST_MISSION.scr", missions)
        self.assertIn("TEST_MAP.mct", missions)
        self.assertIn("TEST_MAP.gf", missions)
        # Logs: no tab-delimited data rows
        self._assert_no_data_rows(log)
        self.assertIn("extension .bmp:", log)
        self.assertIn("readme:", log)

    def test_verify_duplicate_class_key_shape(self) -> None:
        rc, log = self._run("verify")
        self.assertEqual(rc, 0)
        payload = json.loads((self.out / "shiplist-ftrlist-ce-2.670.json").read_text(encoding="utf-8"))
        sl = payload["shiplist"]
        self.assertEqual(sl["table"]["encoding"], "ascii")
        self.assertEqual(sl["table"]["lineEndings"], "CRLF")
        self.assertEqual(sl["table"]["delimiter"], "TAB")
        self.assertEqual(sl["table"]["columnCount"], 7)
        self.assertEqual(sl["table"]["rowCount"], 5)
        self.assertEqual(len(sl["copies"]), 2)
        self.assertTrue(sl["copies"][0]["sha256"] == sl["copies"][1]["sha256"])
        self.assertFalse(sl["uniqueness"]["unique"])
        self.assertEqual(sl["uniqueness"]["duplicateKeyCount"], 1)
        keys = sl["uniqueness"]["duplicateKeys"]
        self.assertEqual(keys[0]["key"], "Federation:TEST-CA-01")
        self.assertEqual(keys[0]["race"], "Federation")
        self.assertEqual(keys[0]["className"], "TEST-CA-01")
        # 1-based source lines: header is line 1, first two data rows are 2 and 3
        self.assertEqual(keys[0]["rows"], [2, 3])
        diags = sl["diagnostics"]
        self.assertEqual(len(diags), 1)
        d = diags[0]
        self.assertEqual(d["code"], "duplicateClassKey")
        self.assertEqual(d["source"], "shiplist")
        self.assertEqual(d["severity"], "error")
        self.assertEqual(d["details"]["race"], "Federation")
        self.assertEqual(d["details"]["className"], "TEST-CA-01")
        self.assertEqual(d["details"]["rows"], [2, 3])
        # No other fields leaked into the diagnostic
        self.assertEqual(set(d.keys()), {"code", "source", "severity", "details"})
        self.assertEqual(set(d["details"].keys()), {"race", "className", "rows"})
        self.assertTrue(sl["fightersAndPfs"]["fightersPresent"])
        self.assertTrue(sl["fightersAndPfs"]["pfsPresent"])
        self.assertIn("FTR", sl["fightersAndPfs"]["fighterHullTokens"])
        self.assertIn("PF", sl["fightersAndPfs"]["pfHullTokens"])
        weapon = {item["code"]: item for item in sl["weaponCodes"]}
        self.assertEqual(weapon["Ph1"]["rows"], 2)
        self.assertEqual(weapon["Ph1"]["occurrences"], 2)
        self.assertEqual(weapon["Phot"]["rows"], 1)
        self.assertIn("Dis1", weapon)
        arc = {item["code"]: item for item in sl["arcCodes"]}
        self.assertEqual(arc["FA"]["rows"], 3)
        self.assertIn("FH", arc)
        # ftrlist is unique, LF, and has no weapon columns in this fixture
        fl = payload["ftrlist"]
        self.assertEqual(fl["table"]["lineEndings"], "LF")
        self.assertTrue(fl["uniqueness"]["unique"])
        self.assertEqual(fl["uniqueness"]["duplicateKeyCount"], 0)
        self.assertEqual(fl["diagnostics"], [])
        # ftrlist Type/Ship Class exist; Race + Ship Class should be unique
        md = (self.out / "shiplist-ftrlist-ce-2.670.md").read_text(encoding="utf-8")
        self.assertIn("code=duplicateClassKey", md)
        self.assertIn("source=shiplist", md)
        self._assert_no_data_rows(log)
        # Duplicate key may appear in the log, but not a full tab-separated ship row.
        self.assertIn("code=duplicateClassKey", log)
        self.assertIn("source=shiplist", log)
        self.assertNotIn("Phot\tFH", log)
        # .bft path/size in verify output
        self.assertEqual(payload["bft"]["count"], 1)
        self.assertEqual(payload["q3"]["extracted"], [])
        self.assertEqual(payload["q3"]["reference"], [])

    def test_unique_shiplist_has_no_diagnostic(self) -> None:
        # Rewrite a unique copy in a side tree.
        side = self.tmpdir / "unique"
        if side.exists():
            shutil.rmtree(side)
        shutil.copytree(self.extracted, side)
        unique = (
            "Race\tHull Type\tClass\tWeapon 1\tArc 1\r\n"
            "Federation\tCA\tTEST-CA-01\tPh1\tFA\r\n"
            "Klingon\tFF\tTEST-FF-02\tDis1\tFX\r\n"
        )
        (side / "Assets/Specs/shiplist.txt").write_bytes(unique.encode("ascii"))
        (side / "MetaAssets/shiplist.txt").write_bytes(unique.encode("ascii"))
        # Refresh hashes in a tiny manifest of just those files — easier to run verify_spec_tables directly.
        path = side / "Assets/Specs/shiplist.txt"
        log = inv.MetadataLog(stream=io.StringIO())
        meta = inv.FileMeta(
            path="Assets/Specs/shiplist.txt",
            size=path.stat().st_size,
            sha256=inv.file_sha256(path),
        )
        result = inv.verify_spec_tables("shiplist", [(path, meta)], side, log)
        self.assertTrue(result.uniqueness["unique"])
        self.assertEqual(result.diagnostics, [])


    # Unique value planted only in a synthetic *data* cell, never in a header,
    # path, race, class, hull, weapon or arc field that metadata logs may list.
    SENTINEL = "SENTINEL_NOLOG_ZX9Q4_TESTROW"

    def test_workflow_command_lines_parse(self) -> None:
        """The exact flag sets and order from main's private-inventory.yml (03a4039)."""
        inventory_argv = [
            "inventory",
            "--extracted",
            "/srv/sfc2/extracted/2.670",
            "--reference",
            "/srv/sfc2/reference/2.670",
            "--manifest",
            "/srv/sfc2/extracted/2.670/manifest.json",
            "--readme",
            "/srv/sfc2/README.md",
            "--output-dir",
            "docs/formats/inventory",
        ]
        verify_argv = [
            "verify",
            "--extracted",
            "/srv/sfc2/extracted/2.670",
            "--reference",
            "/srv/sfc2/reference/2.670",
            "--manifest",
            "/srv/sfc2/extracted/2.670/manifest.json",
            "--output-dir",
            "docs/formats/inventory",
        ]
        inv_args = inv.build_parser().parse_args(inventory_argv)
        ver_args = inv.build_parser().parse_args(verify_argv)
        self.assertEqual(inv_args.command, "inventory")
        self.assertEqual(ver_args.command, "verify")
        self.assertEqual(inv_args.extracted, Path("/srv/sfc2/extracted/2.670"))
        self.assertEqual(inv_args.reference, Path("/srv/sfc2/reference/2.670"))
        self.assertEqual(inv_args.manifest, Path("/srv/sfc2/extracted/2.670/manifest.json"))
        self.assertEqual(inv_args.readme, Path("/srv/sfc2/README.md"))
        self.assertEqual(inv_args.output_dir, Path("docs/formats/inventory"))
        self.assertEqual(ver_args.extracted, Path("/srv/sfc2/extracted/2.670"))
        self.assertEqual(ver_args.manifest, Path("/srv/sfc2/extracted/2.670/manifest.json"))
        self.assertEqual(ver_args.output_dir, Path("docs/formats/inventory"))

    def test_workflow_command_lines_end_to_end_no_data_rows_in_logs(self) -> None:
        """Run the exact workflow command lines against a synthetic tree.

        A unique sentinel is placed only in a data cell (a Notes column), not in
        any header or identifier that metadata logs may emit. The sentinel must
        not appear on stdout or stderr.
        """
        side = self.tmpdir / "workflow-e2e"
        if side.exists():
            shutil.rmtree(side)
        extracted = side / "extracted"
        reference = side / "reference"
        out = side / "out"
        shutil.copytree(self.extracted, extracted)
        shutil.copytree(self.reference, reference)
        readme = side / "README.md"
        shutil.copyfile(self.readme, readme)
        out.mkdir()

        def plant(rel: str, header: str, body_lines: list[str]) -> None:
            path = extracted / rel
            path.write_bytes((header + "\r\n" + "\r\n".join(body_lines) + "\r\n").encode("ascii"))

        # Keep the same identifier/weapon vocabulary; add a Notes column with the sentinel.
        plant(
            "Assets/Specs/shiplist.txt",
            "Race\tHull Type\tClass\tWeapon 1\tArc 1\tWeapon 2\tArc 2\tNotes",
            [
                f"Federation\tCA\tTEST-CA-01\tPh1\tFA\tPhot\tFH\t{self.SENTINEL}",
                "Federation\tCA\tTEST-CA-01\tPh1\tFA\t\t\t",
                "Klingon\tFF\tTEST-FF-02\tDis1\tFX\tDroA\t4\t",
                "Hydran\tFTR\tTEST-FTR-01\tPhG\tALL\t\t\t",
                "Klingon\tPF\tTEST-PF-02\tDis1\tFA\t\t\t",
            ],
        )
        shutil.copyfile(extracted / "Assets/Specs/shiplist.txt", extracted / "MetaAssets/shiplist.txt")

        # Refresh manifest hashes/sizes for the rewritten tables (path/size/hash only).
        manifest_path = extracted / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        by_path = {e["path"]: e for e in manifest["files"]}
        for rel in ("Assets/Specs/shiplist.txt", "MetaAssets/shiplist.txt"):
            data = (extracted / rel).read_bytes()
            by_path[rel]["size"] = len(data)
            by_path[rel]["sha256"] = sha(data)
        manifest["files"] = list(by_path.values())
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

        script = ROOT / "tools" / "inventory" / "inventory.py"
        # Exact argument order from .github/workflows/private-inventory.yml on main (03a4039).
        inventory_cmd = [
            sys.executable,
            str(script),
            "inventory",
            "--extracted",
            str(extracted),
            "--reference",
            str(reference),
            "--manifest",
            str(manifest_path),
            "--readme",
            str(readme),
            "--output-dir",
            str(out),
        ]
        verify_cmd = [
            sys.executable,
            str(script),
            "verify",
            "--extracted",
            str(extracted),
            "--reference",
            str(reference),
            "--manifest",
            str(manifest_path),
            "--output-dir",
            str(out),
        ]

        for cmd in (inventory_cmd, verify_cmd):
            proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, check=False)
            logs = (proc.stdout or "") + (proc.stderr or "")
            self.assertEqual(proc.returncode, 0, msg=f"cmd={cmd[2:]} rc={proc.returncode}\n{logs}")
            self.assertNotIn(
                self.SENTINEL,
                proc.stdout or "",
                "sentinel from a synthetic data row leaked to stdout",
            )
            self.assertNotIn(
                self.SENTINEL,
                proc.stderr or "",
                "sentinel from a synthetic data row leaked to stderr",
            )
            self._assert_no_data_rows(proc.stdout or "")
            self._assert_no_data_rows(proc.stderr or "")

        self.assertTrue((out / "ce-2.670.json").is_file())
        self.assertTrue((out / "ce-2.670.md").is_file())
        self.assertTrue((out / "missions-ce-2.670.md").is_file())
        self.assertTrue((out / "shiplist-ftrlist-ce-2.670.json").is_file())
        self.assertTrue((out / "shiplist-ftrlist-ce-2.670.md").is_file())
        # Metadata outputs must not reproduce the planted data-row sentinel either.
        for name in (
            "ce-2.670.json",
            "ce-2.670.md",
            "missions-ce-2.670.md",
            "observations-ce-2.670.json",
            "shiplist-ftrlist-ce-2.670.json",
            "shiplist-ftrlist-ce-2.670.md",
        ):
            body = (out / name).read_text(encoding="utf-8")
            self.assertNotIn(self.SENTINEL, body, f"sentinel leaked into {name}")

    def test_logs_redact_tab_data_rows(self) -> None:
        log = inv.MetadataLog(stream=io.StringIO())
        log.info("Federation\tCA\tTEST-CA-01\tPh1")
        self.assertIn("redacted", "\n".join(log.lines))
        log.info("shiplist header names: [\"Race\", \"Class\"]")
        self.assertTrue(any("header names:" in line for line in log.lines))

    def _assert_no_data_rows(self, log: str) -> None:
        for line in log.splitlines():
            if "\t" in line and "header names:" not in line.lower() and not line.lower().startswith("headers:"):
                # Three or more tab fields that look like a ship row should not appear.
                if line.count("\t") >= 2 and "TEST-CA-01" in line and "Ph1" in line:
                    self.fail(f"log appears to contain a data row: {line!r}")


if __name__ == "__main__":
    unittest.main()
