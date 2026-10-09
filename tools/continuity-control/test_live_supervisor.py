"""Offline regression checks for the third-terminal supervisor."""
import importlib.util
import io
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch

SOURCE = Path(__file__).with_name("live_supervisor.py")
spec = importlib.util.spec_from_file_location("blochfield_live_supervisor", SOURCE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class SupervisorSafetyTests(TestCase):
    def test_missing_exact_head_ci_fails_closed(self):
        with patch.object(mod.shutil, "which", return_value="/usr/bin/gh"), \
             patch.object(mod, "run", return_value='{"workflow_runs": []}'):
            with self.assertRaisesRegex(RuntimeError, "no exact-head"):
                mod.exact_ci("YasmindIess/bi-ble", "a" * 40, Path("/tmp"))

    def test_dirty_checkout_cannot_be_pulled(self):
        with TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory / ".git").mkdir()
            operations = []
            def fake_run(argv, cwd, timeout=35):
                operations.append(argv)
                if argv[:4] == ["git", "remote", "get-url", "origin"]:
                    return "https://github.com/YasmindIess/bi-ble.git"
                if argv[1:3] == ["branch", "--show-current"]:
                    return "feat/continuity-handoff-v1"
                if argv[1] == "status":
                    return " M working.txt"
                raise AssertionError(f"unexpected operation: {argv}")
            with patch.object(mod, "run", side_effect=fake_run):
                result = mod.synchronize("bi-ble", "YasmindIess/bi-ble", directory,
                                         "feat/continuity-handoff-v1")
            self.assertEqual(result["state"], "held")
            self.assertIn("dirty tree", result["reason"])
            self.assertFalse(any("fetch" in argv for argv in operations))

    def test_external_server_is_never_terminated(self):
        mod.CHILDREN.clear()
        with patch.object(mod, "listening", return_value=True):
            outcome = mod.start("cinema", ["bash", "run-local.sh"], Path("/tmp"), 8765)
        self.assertIn("external", outcome)
        self.assertNotIn("cinema", mod.CHILDREN)

    def test_direct_capture_blocks_supervisor_restart(self):
        def response(request, timeout=1.25):
            data = '{"status":"idle"}' if request.endswith('/api/loop/status') else '{"status":"running"}'
            return io.BytesIO(data.encode())
        with patch.object(mod, "listening", return_value=True), \
             patch.object(mod.urllib.request, "urlopen", side_effect=response) as fetch:
            self.assertTrue(mod.busy_capture())
            self.assertEqual(fetch.call_count, 2)

    def test_operator_cycle_blocks_supervisor_restart(self):
        with patch.object(mod, "listening", return_value=True), \
             patch.object(mod.urllib.request, "urlopen", return_value=io.BytesIO(b'{"status":"running"}')) as fetch:
            self.assertTrue(mod.busy_capture())
            self.assertEqual(fetch.call_count, 1)

    def test_unreadable_active_server_fails_closed(self):
        with patch.object(mod, "listening", return_value=True), \
             patch.object(mod.urllib.request, "urlopen", side_effect=OSError("status unavailable")):
            self.assertTrue(mod.busy_capture())

    def test_both_capture_views_idle_allow_restart(self):
        with patch.object(mod, "listening", return_value=True), \
             patch.object(mod.urllib.request, "urlopen", return_value=io.BytesIO(b'{"status":"idle"}')):
            self.assertFalse(mod.busy_capture())

    def test_absent_server_is_not_treated_as_active_capture(self):
        with patch.object(mod, "listening", return_value=False), \
             patch.object(mod.urllib.request, "urlopen") as fetch:
            self.assertFalse(mod.busy_capture())
            fetch.assert_not_called()

    def test_no_new_head_means_no_ci_or_merge(self):
        with TemporaryDirectory() as tmp:
            directory = Path(tmp)
            (directory / ".git").mkdir()
            def fake_run(argv, cwd, timeout=35):
                op = " ".join(argv)
                if "remote get-url" in op:
                    return "https://github.com/YasmindIess/bi-ble.git"
                if "branch --show-current" in op:
                    return "feat/continuity-handoff-v1"
                if "status --porcelain" in op:
                    return ""
                if "rev-parse HEAD" in op or "rev-parse FETCH_HEAD" in op:
                    return "a" * 40
                if "fetch" in op:
                    return ""
                raise AssertionError(op)
            with patch.object(mod, "run", side_effect=fake_run), patch.object(mod, "exact_ci") as gate:
                result = mod.synchronize("bi-ble", "YasmindIess/bi-ble", directory,
                                         "feat/continuity-handoff-v1")
                gate.assert_not_called()
            self.assertEqual(result["state"], "current")


if __name__ == "__main__":
    main()
