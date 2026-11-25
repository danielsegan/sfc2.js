#!/usr/bin/env python3
"""Synthetic tests for build_envelope.py. No game data."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_envelope import build_envelope, is_canonical_skipped, parse_skipped_token


def hull(name, spawn, skipped, runs, status="ok"):
    return {
        "designation": name,
        "spawnKey": spawn,
        "status": status,
        "skipped": skipped,
        "runs": runs,
    }


def run(label, spawn, kind="het", speed=31, button="port", pad=90, **kw):
    rec = {
        "label": label,
        "spawnKey": spawn,
        "kind": kind,
        "target_speed": speed,
        "button": button,
        "het_pad_deg": pad,
    }
    rec.update(kw)
    return rec


class ParseSkippedTest(unittest.TestCase):
    def test_s31_port_damaged(self):
        p = parse_skipped_token("s31-port:damaged")
        self.assertEqual(p["core"], "s31-port")
        self.assertEqual(p["speed"], 31.0)
        self.assertEqual(p["button"], "port")

    def test_weapons_damaged(self):
        p = parse_skipped_token("weapons:damaged")
        self.assertEqual(p["core"], "weapons")
        self.assertIsNone(p["speed"])


class EnvelopeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.canon = self.root / "canon"
        self.canon.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def write_canon(self, filename, doc):
        (self.canon / filename).write_text(json.dumps(doc) + "\n")

    def extras(self, runs):
        path = self.root / "extras.json"
        path.write_text(json.dumps({"runs": runs}) + "\n")
        return [path]

    def test_excludes_135_and_keeps_90(self):
        sk = "Test:T-AA"
        self.write_canon("1-AA.json", hull("T-AA", sk, [], [
            run("t-aa-s5-port", sk, speed=5, pad=90),
            run("t-aa-s5-hard", sk, speed=5, button="hard_port", pad=135),
        ]))
        runs, pre = build_envelope(self.canon, [])
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0]["het_pad_deg"], 90)
        self.assertEqual(pre["excluded_het_pad_deg"]["135"], 1)

    def test_drops_extra_matching_canonical_skipped(self):
        sk = "Test:T-FF"
        self.write_canon("3-FF.json", hull("T-FF", sk, ["s31-port:damaged"], [
            run("t-ff-s5-port", sk, speed=5),
        ]))
        leaked = run("t-ff-s31-port", sk, speed=31)
        added = run("t-ff-s15-port", sk, speed=15)
        runs, pre = build_envelope(self.canon, self.extras([leaked, added]))
        labels = {r["label"] for r in runs}
        self.assertIn("t-ff-s5-port", labels)
        self.assertIn("t-ff-s15-port", labels)
        self.assertNotIn("t-ff-s31-port", labels)
        self.assertEqual(pre["extra_skipped_canonical"], 1)
        self.assertEqual(pre["extra_tagged_added"], 1)
        self.assertEqual(pre["skip_damaged_total"], 1)

    def test_drops_extra_by_speed_and_button_if_label_differs(self):
        sk = "Test:T-CC"
        self.write_canon("6-CC.json", hull("T-CC", sk, ["s31-port:damaged"], []))
        leaked = run("research-cc-s31-port", sk, speed=31, button="port")
        runs, pre = build_envelope(self.canon, self.extras([leaked]))
        self.assertEqual(runs, [])
        self.assertEqual(pre["extra_skipped_canonical"], 1)

    def test_does_not_delete_sources(self):
        sk = "Test:T-AA"
        path = self.canon / "1-AA.json"
        doc = hull("T-AA", sk, ["s31-port:damaged"], [run("t-aa-s5-port", sk, speed=5)])
        path.write_text(json.dumps(doc) + "\n")
        before = path.read_text()
        extra = self.extras([run("t-aa-s31-port", sk, speed=31)])[0]
        extra_before = extra.read_text()
        build_envelope(self.canon, [extra])
        self.assertEqual(path.read_text(), before)
        self.assertEqual(extra.read_text(), extra_before)

    def test_keeps_multiple_canonical_samples(self):
        sk = "Test:T-FF"
        self.write_canon("3-FF.json", hull("T-FF", sk, [], [
            run("t-ff-s31-port", sk, speed=31, total_turn_deg=-90.0),
            run("t-ff-s31-port", sk, speed=31, total_turn_deg=-88.0, suspect_rerun=True),
        ]))
        runs, _ = build_envelope(self.canon, [])
        self.assertEqual(len(runs), 2)

    def test_is_canonical_skipped_helper(self):
        idx = {"Test:T-FF": [parse_skipped_token("s31-port:damaged")]}
        self.assertTrue(is_canonical_skipped(run("t-ff-s31-port", "Test:T-FF"), idx))
        self.assertFalse(is_canonical_skipped(run("t-ff-s5-port", "Test:T-FF", speed=5), idx))


if __name__ == "__main__":
    unittest.main()
