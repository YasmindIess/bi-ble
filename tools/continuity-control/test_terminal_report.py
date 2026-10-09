"""Offline safety and rendering tests for read-only terminal reports."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch
import json

spec = spec_from_file_location("terminal_report_under_test", Path(__file__).with_name("terminal_report.py"))
mod = module_from_spec(spec)
spec.loader.exec_module(mod)


class TerminalReportTests(TestCase):
    def test_strip_untrusted_terminal_controls(self):
        self.assertEqual(mod.clean("good\x1b[2J\x1b[31mred\x00"), "goodred ")

    def test_json_missing_or_corrupt_fails_closed(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "bad.json"
            self.assertEqual(mod.read_json(path), {})
            path.write_text("{invalid")
            self.assertEqual(mod.read_json(path), {})

    def test_vite_report_contains_head_owner_and_ci(self):
        state = {"vite": "owned", "supervisor_pid": 33, "checked_at": "2026-10-09T18:00:00-0300",
                 "repos": [
                     {"name": "bi-ble", "state": "current", "branch": "feat/test",
                      "head": "a" * 40},
                     {"name": "conductor", "state": "current", "head": "b" * 40},
                     {"name": "nice-robin", "state": "current", "head": "c" * 40}
                 ]}
        with patch.object(mod, "event_rows", return_value=[]), patch.object(mod, "tail", return_value=[]):
            text = "\n".join(v for _, v in mod.report("vite", state, {"http": True}, None, 0))
        self.assertIn("BI-BLE", text)
        self.assertIn("owned", text)
        self.assertIn("feat/test", text)
        self.assertIn("Incoming CI:", text)

    def test_cinema_report_tracks_actual_loop_and_capture(self):
        state = {"cinema": "owned", "repos": [{"name": "cinema", "state": "current",
                                               "branch": "main", "head": "d" * 40}]}
        data = {"http": True, "loop": {"status": "held", "phase": "capture"},
                "captures": {"cycles": [{"id": "2026-10-09T17-38-23-003Z", "status": "passed", "frames": []}]},
                "edge": {"configured": True, "auto_push": False}}
        with patch.object(mod, "event_rows", return_value=[]), patch.object(mod, "tail", return_value=[]):
            text = "\n".join(v for _, v in mod.report("cinema", state, data, None, 0))
        self.assertIn("held", text)
        self.assertIn("2026-10-09T17-38-23", text)
        self.assertIn("automatic=False", text)
        self.assertIn("NOT verified", text)

    def test_held_cinema_exposes_ci_error_without_hiding_it(self):
        state = {"cinema": "owned", "repos": [
            {"name": "cinema", "state": "held", "branch": "main",
             "head": "32f1227", "reason": "Cinema CI/runtime prerequisite: no exact-head CI"}
        ]}
        with patch.object(mod, "event_rows", return_value=[]), patch.object(mod, "tail", return_value=[]):
            text = "\n".join(v for _, v in mod.report("cinema", state,
                            {"http": True, "loop": {}, "captures": {}, "edge": {}}, None, 0))
        self.assertIn("Hold reason:", text)
        self.assertIn("no exact-head CI", text)

    def test_event_log_contains_structured_only(self):
        with TemporaryDirectory() as temp:
            path = Path(temp) / "events.jsonl"
            path.write_text(json.dumps({"at":"2026-10-09T18:00:00-0300","subject":"bi-ble",
                                         "state":"revision","detail":"7cd8628a"})+"\n")
            with patch.object(mod, "EVENTS", path):
                events = mod.event_rows()
            self.assertTrue(events and "revision" in events[-1])


if __name__ == "__main__":
    main()
