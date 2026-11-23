#!/usr/bin/env python3
"""Synthetic-fixture tests for tools/inventory/inventory.py.

No original game files. Temporary binaries (.bmp, .mct, .gf, .scr, .bft)
are created in a tmp directory and never committed.
"""

from __future__ import annotations

import hashlib
import struct
import io
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

import inventory as inv  # noqa: E402

FIXTURES = ROOT / "tools" / "fixtures" / "inventory"



def synth_bmp(width: int, height: int, bit_count: int, compression: int = 0) -> bytes:
    """Minimal valid BMP file header + zeroed pixels. No copied game art."""
    if bit_count == 8:
        row = (width + 3) & ~3
        payload = bytes(256 * 4) + bytes(row * max(abs(height), 1))
        off = 14 + 40 + 256 * 4
    elif bit_count == 16:
        row = (width * 2 + 3) & ~3
        payload = bytes(row * max(abs(height), 1))
        off = 14 + 40
    else:
        bpp = max(bit_count // 8, 1)
        row = (width * bpp + 3) & ~3
        payload = bytes(row * max(abs(height), 1))
        off = 14 + 40
    pixel_len = len(payload) - (256 * 4 if bit_count == 8 else 0)
    file_size = off + pixel_len
    return (
        struct.pack("<2sIHHI", b"BM", file_size, 0, 0, off)
        + struct.pack(
            "<IiiHHIIiiII",
            40,
            width,
            height,
            1,
            bit_count,
            compression,
            pixel_len,
            0,
            0,
            0,
            0,
        )
        + payload
    )


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
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01.bmp", synth_bmp(2, 2, 24), entries)
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01_i.bmp", synth_bmp(2, 2, 24), entries)
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01_illum.bmp", synth_bmp(2, 2, 24), entries)
        add_file(cls.extracted, "Assets/GUI/Menus/button.bmp", synth_bmp(4, 4, 24), entries)
        # _<n>i self-illum pairs for header-only bit-depth comparison.
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01_1.bmp", synth_bmp(8, 8, 24), entries)
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01_1i.bmp", synth_bmp(8, 8, 24), entries)
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01_2.bmp", synth_bmp(8, 8, 24), entries)
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01_2i.bmp", synth_bmp(8, 8, 16), entries)
        add_file(cls.extracted, "Assets/Models/test_ca01/test_ca01_3i.bmp", synth_bmp(4, 4, 24), entries)
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
        pairs = observations["bmp"]["illumPairs"]
        self.assertEqual(pairs["illumCount"], 3)
        self.assertEqual(pairs["pairedCount"], 2)
        self.assertEqual(pairs["missingBaseCount"], 1)
        self.assertEqual(pairs["depthMatches"], 1)
        self.assertEqual(pairs["depthDiffers"], 1)
        self.assertEqual(len(pairs["differingPairs"]), 1)
        self.assertEqual(pairs["differingPairs"][0]["illum"]["bitCount"], 16)
        self.assertEqual(pairs["differingPairs"][0]["base"]["bitCount"], 24)
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
        # Comment/instruction on line 1 is skipped; the real header is line 2.
        self.assertEqual(sl["table"]["headerLine"], 2)
        self.assertEqual(sl["table"]["columnCount"], 11)
        self.assertEqual(
            sl["table"]["headerNames"],
            [
                "Race",
                "Hull Type",
                "Class",
                "Weapon 1",
                "Arc 1",
                "Weapon 2",
                "Arc 2",
                "Weapon 11",
                "Arc 11",
                "",
                "",
            ],
        )
        self.assertEqual(sl["table"]["rowCount"], 5)
        self.assertEqual(len(sl["copies"]), 2)
        # Specs and MetaAssets copies are intentionally different; source is Specs.
        self.assertNotEqual(sl["copies"][0]["sha256"], sl["copies"][1]["sha256"])
        self.assertEqual(sl["sourcePath"], "Assets/Specs/shiplist.txt")
        self.assertNotIn("MetaAssets", sl["sourcePath"] or "")
        self.assertFalse(sl["uniqueness"]["unique"])
        self.assertEqual(sl["uniqueness"]["duplicateKeyCount"], 1)
        keys = sl["uniqueness"]["duplicateKeys"]
        self.assertEqual(keys[0]["key"], "Federation:TEST-CA-01")
        self.assertEqual(keys[0]["race"], "Federation")
        self.assertEqual(keys[0]["className"], "TEST-CA-01")
        # 1-based source lines: comment is line 1, header is line 2, first two data rows are 3 and 4
        self.assertEqual(keys[0]["rows"], [3, 4])
        self.assertEqual(sl["uniqueness"]["duplicateClassNameCount"], 1)
        names = sl["uniqueness"]["duplicateClassNames"]
        self.assertEqual(names[0]["className"], "TEST-CA-01")
        self.assertEqual(names[0]["rows"], [3, 4])
        diags = sl["diagnostics"]
        self.assertEqual({d["code"] for d in diags}, {"duplicateClassKey", "duplicateClassName"})
        d = next(x for x in diags if x["code"] == "duplicateClassKey")
        self.assertEqual(d["source"], "shiplist")
        self.assertEqual(d["severity"], "error")
        self.assertEqual(d["details"]["race"], "Federation")
        self.assertEqual(d["details"]["className"], "TEST-CA-01")
        self.assertEqual(d["details"]["rows"], [3, 4])
        # No other fields leaked into the diagnostic
        self.assertEqual(set(d.keys()), {"code", "source", "severity", "details"})
        self.assertEqual(set(d["details"].keys()), {"race", "className", "rows"})
        n = next(x for x in diags if x["code"] == "duplicateClassName")
        self.assertEqual(n["source"], "shiplist")
        self.assertEqual(n["severity"], "warning")
        self.assertEqual(n["details"], {"className": "TEST-CA-01", "rows": [3, 4]})
        self.assertEqual(set(n["details"].keys()), {"className", "rows"})
        self.assertTrue(sl["fightersAndPfs"]["fightersPresent"])
        self.assertEqual(sl["fightersAndPfs"]["fighterRowCount"], 1)
        self.assertTrue(sl["fightersAndPfs"]["pfsPresent"])
        self.assertEqual(sl["fightersAndPfs"]["pfRowCount"], 1)
        self.assertIn("FTR", sl["fightersAndPfs"]["fighterHullTokens"])
        self.assertIn("PF", sl["fightersAndPfs"]["pfHullTokens"])
        weapon = {item["code"]: item for item in sl["weaponCodes"]}
        self.assertEqual(weapon["Ph1"]["rows"], 2)
        self.assertEqual(weapon["Ph1"]["occurrences"], 2)
        self.assertEqual(weapon["Ph1"]["slots1to10"], {"rows": 2, "occurrences": 2})
        self.assertEqual(weapon["Ph1"]["slots11to25"], {"rows": 0, "occurrences": 0})
        self.assertEqual(weapon["Phot"]["rows"], 1)
        self.assertEqual(weapon["Phot"]["slots1to10"]["rows"], 1)
        self.assertEqual(weapon["ESG"]["rows"], 1)
        self.assertEqual(weapon["ESG"]["slots1to10"], {"rows": 0, "occurrences": 0})
        self.assertEqual(weapon["ESG"]["slots11to25"], {"rows": 1, "occurrences": 1})
        self.assertIn("Dis1", weapon)
        arc = {item["code"]: item for item in sl["arcCodes"]}
        self.assertEqual(arc["FA"]["rows"], 3)
        self.assertIn("FH", arc)
        self.assertEqual(arc["FH"]["slots1to10"]["rows"], 1)
        self.assertEqual(arc["FH"]["slots11to25"]["rows"], 1)
        # ftrlist is unique, LF, and has no weapon columns in this fixture
        fl = payload["ftrlist"]
        self.assertEqual(fl["table"]["lineEndings"], "LF")
        self.assertTrue(fl["uniqueness"]["unique"])
        self.assertEqual(fl["uniqueness"]["duplicateKeyCount"], 0)
        self.assertEqual(fl["diagnostics"], [])
        speed = next(s for s in fl["numericColumnStats"] if s["column"] == "Speed")
        self.assertEqual(speed["min"], 17)
        self.assertEqual(speed["max"], 26)
        self.assertEqual(speed["maxDecimalPlaces"], 0)
        # Default shiplist has no all-numeric columns (weapon codes are vocabulary).
        race_counts = {r["race"]: r["rows"] for r in sl["raceRowCounts"]}
        self.assertEqual(race_counts["Federation"], 2)
        self.assertEqual(race_counts["Klingon"], 2)
        self.assertEqual(race_counts["Hydran"], 1)
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

        def plant(rel: str, header: str, body_lines: list[str], comment: str | None = None) -> None:
            path = extracted / rel
            parts: list[str] = []
            if comment is not None:
                parts.append(comment)
            parts.append(header)
            parts.extend(body_lines)
            path.write_bytes(("\r\n".join(parts) + "\r\n").encode("ascii"))

        # Keep the same identifier/weapon vocabulary; add a Notes column with the sentinel.
        # Leading comment/instruction line must be skipped and must not leak the sentinel.
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
            comment="\tSYNTHETIC FIXTURE ONLY. Keep the first column blank to write a comment.\t\t\t\t\t\t\t",
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



    def test_race_header_accepted_with_long_label(self) -> None:
        """A first nonempty cell of Race wins even when another label is long."""
        path = self.tmpdir / "long-header-shiplist.txt"
        long_label = "X" * 80
        # Invented header only; the long token is not a data row.
        path.write_bytes(
            (
                "\tSYNTHETIC FIXTURE ONLY. Keep the first column blank to write a comment.\t\t\t\r\n"
                f"Race\tHull Type\tClass\t{long_label}\r\n"
                "Federation\tCA\tTEST-CA-01\t1\r\n"
            ).encode("ascii")
        )
        buf = io.StringIO()
        log = inv.MetadataLog(stream=buf)
        meta = inv.inspect_table_file(path, self.tmpdir, log=log)
        self.assertEqual(meta.headerLine, 2)
        self.assertEqual(meta.headerNames[0], "Race")
        self.assertEqual(meta.headerNames[3], long_label)
        self.assertEqual(meta.columnCount, 4)
        self.assertIsNone(meta.headerRejection)
        self.assertNotIn(long_label, "\n".join(log.lines))

    def test_header_rejection_log_has_no_cell_text(self) -> None:
        path = self.tmpdir / "no-header-table.txt"
        sentinel = "SENTINEL_REJECT_CELL_QK7"
        path.write_bytes(
            (
                "\tSYNTHETIC FIXTURE ONLY. Keep the first column blank to write a comment.\t\t\r\n"
                f"12\t34\t56\t{sentinel}\r\n"
                "13\t35\t57\t0\r\n"
            ).encode("ascii")
        )
        buf = io.StringIO()
        log = inv.MetadataLog(stream=buf)
        meta = inv.inspect_table_file(path, self.tmpdir, log=log)
        self.assertEqual(meta.headerNames, [])
        self.assertIsNotNone(meta.headerRejection)
        self.assertEqual(meta.headerRejection["line"], 2)
        self.assertEqual(meta.headerRejection["reason"], "mostly-numeric")
        self.assertIn("nonemptyCells", " ".join(log.lines) + str(meta.headerRejection))
        joined = "\n".join(log.lines)
        self.assertNotIn(sentinel, joined)
        self.assertNotIn(sentinel, json.dumps(meta.headerRejection))
        self.assertIn("header candidate rejected:", joined)
        self.assertIn("reason=mostly-numeric", joined)
        self.assertGreaterEqual(meta.dataColumnCountMin or 0, 4)
        self.assertGreaterEqual(meta.columnCount, 4)

    def test_weapon_group_without_header_reports_column_counts(self) -> None:
        side = self.tmpdir / "wg-nohdr"
        side.mkdir()
        path = side / "NOHDR"
        path.write_bytes("<0\nPh1\t1\t3\nPhG\t2\t4\n".encode("ascii"))
        buf = io.StringIO()
        log = inv.MetadataLog(stream=buf)
        meta = inv.FileMeta(path="NOHDR", size=path.stat().st_size, sha256=inv.file_sha256(path))
        result = inv.inspect_extensionless_tables([meta], side, log)
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["distinctHeaderLayouts"], [])
        self.assertFalse(result["files"][0]["headerIdentified"])
        self.assertGreaterEqual(result["files"][0]["columnCount"], 3)
        self.assertEqual(result["columnLayouts"][0]["headerIdentified"], False)
        self.assertEqual(result["columnLayouts"][0]["columnCount"], 3)
        self.assertNotIn("Ph1", "\n".join(log.lines))

    def test_q3_zip_directory_lists_entry_names(self) -> None:
        side = self.tmpdir / "q3-tree"
        if side.exists():
            shutil.rmtree(side)
        sprites = side / "Assets" / "Sprites"
        sprites.mkdir(parents=True)
        q3 = sprites / "sprites.q3"
        with zipfile.ZipFile(q3, "w") as zf:
            zf.writestr("synthetic/test_icon.bin", b"SYNTH-Q3-ENTRY")
            zf.writestr("synthetic/test_frame.bin", b"XX")
        buf = io.StringIO()
        log = inv.MetadataLog(stream=buf)
        found = inv.find_q3(side, log, "extracted")
        self.assertEqual(len(found), 1)
        rec = found[0]
        self.assertEqual(rec["format"], "zip")
        self.assertEqual(rec["entryCount"], 2)
        names = {e["name"]: e["size"] for e in rec["entries"]}
        self.assertEqual(names["synthetic/test_icon.bin"], 14)
        self.assertEqual(names["synthetic/test_frame.bin"], 2)
        # Directory metadata only: the payload must not be dumped to the log.
        self.assertNotIn("SYNTH-Q3-ENTRY", "\n".join(log.lines))

    def test_numeric_stats_include_speed_and_decimals(self) -> None:
        side = self.tmpdir / "numeric-side"
        if side.exists():
            shutil.rmtree(side)
        side.mkdir()
        path = side / "shiplist.txt"
        path.write_bytes(
            (
                "Race\tHull Type\tClass\tBPV\tMove Cost\r\n"
                "Federation\tCA\tTEST-CA-01\t101\t0.75\r\n"
                "Klingon\tFF\tTEST-FF-02\t42\t0.40\r\n"
            ).encode("ascii")
        )
        buf = io.StringIO()
        log = inv.MetadataLog(stream=buf)
        meta = inv.FileMeta(path="shiplist.txt", size=path.stat().st_size, sha256=inv.file_sha256(path))
        result = inv.verify_spec_tables("shiplist", [(path, meta)], side, log)
        by_col = {s["column"]: s for s in result.numericColumnStats}
        self.assertEqual(by_col["BPV"]["min"], 42)
        self.assertEqual(by_col["BPV"]["max"], 101)
        self.assertEqual(by_col["BPV"]["maxDecimalPlaces"], 0)
        self.assertEqual(by_col["Move Cost"]["min"], 0.4)
        self.assertEqual(by_col["Move Cost"]["max"], 0.75)
        self.assertEqual(by_col["Move Cost"]["maxDecimalPlaces"], 2)
        self.assertEqual({r["race"]: r["rows"] for r in result.raceRowCounts}, {"Federation": 1, "Klingon": 1})
        # Aggregates only: do not log the raw numeric cells as a data row.
        self.assertNotIn("101\t0.75", "\n".join(log.lines))




    def test_heavy_weapon_pairing_and_numeric_arc_sources(self) -> None:
        """Unlabeled Arc columns inherit Heavy Weapon / Weapon slot numbers.

        Numeric codes 1/2/3 are attributed to the Arc column they appear in
        (index + header + row count), not to a Num column, when pairing is correct.
        """
        side = self.tmpdir / "heavy-weapon-side"
        if side.exists():
            shutil.rmtree(side)
        side.mkdir()
        path = side / "shiplist.txt"
        # Num, Heavy Weapon N, Arc groups (CE 2.670 shape) plus Weapon 11.
        # Invented rows only. Codes 1/2/3 sit in Arc cells on purpose.
        path.write_bytes(
            (
                "Race\tHull Type\tClass\tNum\tHeavy Weapon 1\tArc\tNum\tHeavy Weapon 2\tArc\tNum\tWeapon 11\tArc\r\n"
                "Federation\tCA\tTEST-CA-01\t1\tPhot\tFA\t2\tPhoF\t1\t1\tPh1\tFH\r\n"
                "Klingon\tDD\tTEST-DD-02\t1\tESG\t2\t\t\t\t2\tPh3\tFX\r\n"
                "Hydran\tCA\tTEST-CA-03\t1\tFus\tFH\t1\tPlaF\t3\t1\tPh2\tFA\r\n"
            ).encode("ascii")
        )
        buf = io.StringIO()
        log = inv.MetadataLog(stream=buf)
        meta = inv.FileMeta(path="shiplist.txt", size=path.stat().st_size, sha256=inv.file_sha256(path))
        result = inv.verify_spec_tables("shiplist", [(path, meta)], side, log)
        joined = "\n".join(log.lines)
        # Heavy Weapon columns are selected; Phot/ESG live in slots 1-10.
        weapon = {item["code"]: item for item in result.weaponCodes}
        self.assertIn("Phot", weapon)
        self.assertEqual(weapon["Phot"]["slots1to10"], {"rows": 1, "occurrences": 1})
        self.assertEqual(weapon["ESG"]["slots1to10"]["rows"], 1)
        self.assertEqual(weapon["Ph1"]["slots11to25"], {"rows": 1, "occurrences": 1})
        self.assertEqual(weapon["Ph3"]["slots11to25"]["rows"], 1)
        # Arc FA after Heavy Weapon 1 is slot 1, not "other".
        arc = {item["code"]: item for item in result.arcCodes}
        self.assertEqual(arc["FA"]["rows"], 2)
        self.assertEqual(arc["FA"]["slots1to10"]["rows"], 1)
        self.assertEqual(arc["FA"]["slots11to25"]["rows"], 1)
        self.assertEqual(arc["FH"]["slots1to10"]["rows"], 1)
        self.assertEqual(arc["FH"]["slots11to25"]["rows"], 1)
        # 1, 2, 3 come from Arc columns, not Num.
        sources = {rec["code"]: rec for rec in result.numericArcCodeSources}
        self.assertEqual([c["columnIndex"] for c in sources["1"]["columns"]], [8])
        self.assertEqual(sources["1"]["columns"][0]["headerName"], "Arc")
        self.assertEqual(sources["1"]["columns"][0]["slot"], 2)
        self.assertEqual(sources["1"]["columns"][0]["rows"], 1)
        self.assertEqual([c["columnIndex"] for c in sources["2"]["columns"]], [5])
        self.assertEqual(sources["2"]["columns"][0]["headerName"], "Arc")
        self.assertEqual(sources["2"]["columns"][0]["slot"], 1)
        self.assertEqual(sources["2"]["rows"], 1)
        self.assertEqual([c["columnIndex"] for c in sources["3"]["columns"]], [8])
        self.assertEqual(sources["3"]["columns"][0]["slot"], 2)
        for rec in result.numericArcCodeSources:
            for col in rec["columns"]:
                self.assertEqual(col["headerName"], "Arc")
                self.assertNotEqual(col["headerName"].casefold(), "num")
        # Per-slot arc counts for Heavy Weapon 1-2 (and Weapon 11 is not in 1-10).
        by_slot = {rec["slot"]: rec for rec in result.heavyWeaponSlotArcs}
        self.assertEqual(by_slot[1]["weaponColumnName"], "Heavy Weapon 1")
        self.assertEqual(by_slot[1]["weaponColumnIndex"], 4)
        self.assertEqual(by_slot[1]["arcColumnIndex"], 5)
        codes1 = {c["code"]: c for c in by_slot[1]["codes"]}
        self.assertEqual(codes1["FA"]["rows"], 1)
        self.assertEqual(codes1["2"]["rows"], 1)
        self.assertEqual(by_slot[2]["weaponColumnName"], "Heavy Weapon 2")
        self.assertEqual(by_slot[2]["arcColumnIndex"], 8)
        codes2 = {c["code"]: c for c in by_slot[2]["codes"]}
        self.assertEqual(codes2["1"]["rows"], 1)
        self.assertEqual(codes2["3"]["rows"], 1)
        self.assertNotIn(11, by_slot)
        # Logs stay metadata-only: no tab-separated data cells.
        self.assertNotIn("Phot\tFA", joined)
        self.assertIn("numeric arc code 1", joined)
        self.assertIn("heavy weapon slot 1", joined)



    def test_numeric_arc_pairs_with_same_slot_weapon(self) -> None:
        """Numeric Arc cells are counted against the weapon code in the same slot."""
        side = self.tmpdir / "numeric-arc-weapon-side"
        if side.exists():
            shutil.rmtree(side)
        side.mkdir()
        path = side / "shiplist.txt"
        # Invented rows. Dro*/ADD* mostly take 1/2/3; one Phot and one Ph1
        # take a numeric arc so the "other than Dro*/ADD*" path is tested.
        # DroA has a letter arc (FA). ADD12 has an empty arc.
        path.write_bytes(
            (
                "Race\tHull Type\tClass\tNum\tHeavy Weapon 1\tArc\tNum\tHeavy Weapon 2\tArc\tNum\tWeapon 11\tArc\r\n"
                "Federation\tCA\tTEST-CA-01\t1\tDroB\t1\t1\tADD6\t2\t1\tPh1\tFH\r\n"
                "Klingon\tDD\tTEST-DD-02\t1\tDroA\tFA\t1\tPhot\t1\t1\tPh3\t4\r\n"
                "Hydran\tCA\tTEST-CA-03\t1\tADD12\t\t1\tDroC\t3\t1\tPh1\t1\r\n"
            ).encode("ascii")
        )
        buf = io.StringIO()
        log = inv.MetadataLog(stream=buf)
        meta = inv.FileMeta(path="shiplist.txt", size=path.stat().st_size, sha256=inv.file_sha256(path))
        result = inv.verify_spec_tables("shiplist", [(path, meta)], side, log)
        joined = "\n".join(log.lines)
        pairings = result.numericArcWeaponPairings
        by_arc = {rec["arcCode"]: rec for rec in pairings["byNumericArc"]}
        # Arc 1: DroB (slot 1), Phot (slot 2), Ph1 (slot 11)
        w1 = {w["weaponCode"]: w for w in by_arc["1"]["weapons"]}
        self.assertEqual(w1["DroB"]["rows"], 1)
        self.assertEqual(w1["DroB"]["occurrences"], 1)
        self.assertTrue(w1["DroB"]["droneOrAdd"])
        self.assertEqual(w1["DroB"]["slots1to10"]["rows"], 1)
        self.assertEqual(w1["Phot"]["rows"], 1)
        self.assertFalse(w1["Phot"]["droneOrAdd"])
        self.assertEqual(w1["Ph1"]["slots11to25"], {"rows": 1, "occurrences": 1})
        self.assertFalse(w1["Ph1"]["droneOrAdd"])
        # Arc 2 only ADD6; arc 3 only DroC; unexpected integer 4 with Ph3 in slot 11
        w2 = {w["weaponCode"]: w for w in by_arc["2"]["weapons"]}
        self.assertEqual(list(w2), ["ADD6"])
        self.assertTrue(w2["ADD6"]["droneOrAdd"])
        w3 = {w["weaponCode"]: w for w in by_arc["3"]["weapons"]}
        self.assertEqual(list(w3), ["DroC"])
        w4 = {w["weaponCode"]: w for w in by_arc["4"]["weapons"]}
        self.assertEqual(w4["Ph3"]["slots11to25"]["rows"], 1)
        self.assertFalse(pairings["pairsOnlyWithDroneOrAdd"])
        others = {(p["arcCode"], p["weaponCode"]): p for p in pairings["nonDroneOrAddPairings"]}
        self.assertIn(("1", "Phot"), others)
        self.assertIn(("1", "Ph1"), others)
        self.assertIn(("4", "Ph3"), others)
        self.assertNotIn(("1", "DroB"), others)
        self.assertNotIn(("2", "ADD6"), others)
        by_slot = {rec["slot"]: rec for rec in pairings["bySlot"]}
        s1 = {(p["arcCode"], p["weaponCode"]): p for p in by_slot[1]["pairs"]}
        self.assertEqual(s1[("1", "DroB")]["rows"], 1)
        s2 = {(p["arcCode"], p["weaponCode"]): p for p in by_slot[2]["pairs"]}
        self.assertEqual(s2[("2", "ADD6")]["rows"], 1)
        self.assertEqual(s2[("1", "Phot")]["rows"], 1)
        s11 = {(p["arcCode"], p["weaponCode"]): p for p in by_slot[11]["pairs"]}
        self.assertEqual(s11[("4", "Ph3")]["rows"], 1)
        self.assertEqual(s11[("1", "Ph1")]["rows"], 1)
        kinds = pairings["droneAddArcKinds"]
        self.assertEqual(set(kinds["weaponCodes"]), {"DroA", "DroB", "DroC", "ADD6", "ADD12"})
        # Five Dro*/ADD* slot cells: DroB+1, ADD6+2, DroA+FA, ADD12+empty, DroC+3
        self.assertEqual(kinds["filledOrEmptySlots"]["occurrences"], 5)
        self.assertEqual(kinds["numericArc"]["occurrences"], 3)
        self.assertEqual(kinds["letterArc"]["occurrences"], 1)
        self.assertEqual(kinds["emptyArc"]["occurrences"], 1)
        letter_codes = {c["code"]: c for c in kinds["letterArc"]["arcCodes"]}
        self.assertEqual(letter_codes["FA"]["rows"], 1)
        # Logs: vocabulary and counts only, no data rows.
        self.assertNotIn("DroB\t1", joined)
        self.assertIn("numeric arcs pair only with Dro*/ADD6/ADD12: false", joined)
        self.assertIn("Dro*/ADD6/ADD12 slots:", joined)
        # integer 4 is recorded in per-column sources too
        sources = {rec["code"]: rec for rec in result.numericArcCodeSources}
        self.assertIn("4", sources)
        self.assertEqual(sources["4"]["columns"][0]["slot"], 11)


if __name__ == "__main__":
    unittest.main()
