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
    def test_repair_missing_runner_helpers_without_touching_credentials(self):
        with TemporaryDirectory() as temp:
            home=Path(temp)
            source=home / "actions-runner-blochfield"
            dest=home / "cinema-runner"
            source.mkdir()
            dest.mkdir()
            launcher=b"#!/usr/bin/env bash\\necho launcher\\n"
            (source / "run.sh").write_bytes(launcher)
            (dest / "run.sh").write_bytes(launcher)
            (dest / ".runner").write_text('{"agentName":"cinema"}')
            (dest / ".credentials").write_text("private credential")
            for name in ("run-helper.sh.template", "safe_sleep.sh"):
                (source / name).write_text("#!/bin/bash\\necho helper\\n")
            with patch.object(mod, "HOME", home), patch.object(mod, "CI_RUNNER", dest):
                self.assertIsNone(mod.repair_runner_launch_files())
                self.assertIsNone(mod.repair_runner_launch_files())
            for name in ("run-helper.sh.template", "safe_sleep.sh"):
                self.assertEqual((dest / name).read_bytes(), (source / name).read_bytes())
            self.assertEqual((dest / ".credentials").read_text(), "private credential")
            self.assertEqual((dest / ".runner").read_text(), '{"agentName":"cinema"}')

    def test_repair_refuses_mismatched_binary_distribution(self):
        with TemporaryDirectory() as temp:
            home=Path(temp)
            source=home / "actions-runner-blochfield"
            dest=home / "cinema-runner"
            source.mkdir()
            dest.mkdir()
            (source / "run.sh").write_text("source")
            (dest / "run.sh").write_text("different")
            (dest / ".runner").write_text("registered")
            for name in ("run-helper.sh.template", "safe_sleep.sh"):
                (source / name).write_text("safe")
            with patch.object(mod, "HOME", home), patch.object(mod, "CI_RUNNER", dest):
                self.assertIn("no matching trusted runner", mod.repair_runner_launch_files())
            self.assertFalse((dest / "run-helper.sh.template").exists())

    def test_repair_refuses_helper_symlinks(self):
        with TemporaryDirectory() as temp:
            home=Path(temp)
            dest=home / "cinema-runner"
            dest.mkdir()
            (dest / ".runner").write_text("registered")
            (dest / "run.sh").write_text("launcher")
            (dest / "run-helper.sh.template").symlink_to("/etc/passwd")
            (dest / "safe_sleep.sh").write_text("sleep")
            with patch.object(mod, "HOME", home), patch.object(mod, "CI_RUNNER", dest):
                self.assertIn("symlink", mod.repair_runner_launch_files())

    def test_github_online_state_not_inferred_from_process_launch(self):
        with TemporaryDirectory() as temp:
            root=Path(temp)
            (root / ".runner").write_text('{"agentName":"continuity-cinema-YasAnacreto"}')
            remote='{"runners":[{"name":"continuity-cinema-YasAnacreto","status":"offline","busy":false}]}'
            with patch.object(mod, "CI_RUNNER", root), patch.object(mod, "run", return_value=remote):
                self.assertEqual(mod.runner_remote_status(), {"state":"offline","busy":False})
            connected='{"runners":[{"name":"continuity-cinema-YasAnacreto","status":"online","busy":true}]}'
            with patch.object(mod, "CI_RUNNER", root), patch.object(mod, "run", return_value=connected):
                self.assertEqual(mod.runner_remote_status(), {"state":"online","busy":True})

    def test_runner_status_unavailable_is_not_claimed_online(self):
        with TemporaryDirectory() as temp:
            root=Path(temp)
            (root / ".runner").write_text('{"agentName":"cinema"}')
            with patch.object(mod, "CI_RUNNER", root), patch.object(mod, "run", side_effect=RuntimeError("offline API")):
                self.assertEqual(mod.runner_remote_status()["state"], "unverified")

    def test_capture_dependency_ready_never_installs(self):
        with TemporaryDirectory() as temp:
            root=Path(temp)
            (root / "cycle-browser.mjs").write_text("fixture")
            with patch.object(mod.shutil,"which",return_value="/usr/bin/thing"), \
                 patch.object(mod,"busy_capture",return_value=False), \
                 patch.object(mod,"run",return_value="") as execute:
                self.assertEqual(mod.ensure_capture_runtime(root),"ready")
            self.assertEqual(execute.call_count,1)
            self.assertEqual(execute.call_args.args[0][0],"node")

    def test_capture_dependency_installs_only_pinned_no_save_package(self):
        with TemporaryDirectory() as temp:
            root=Path(temp)
            (root / "cycle-browser.mjs").write_text("fixture")
            seen=[]
            def execution(args,cwd,timeout=35):
                seen.append(args)
                if len(seen)<=2:
                    raise RuntimeError("ERR_MODULE_NOT_FOUND")
                return ""
            with patch.object(mod.shutil,"which",return_value="/usr/bin/thing"), \
                 patch.object(mod,"busy_capture",return_value=False), \
                 patch.object(mod,"run",side_effect=execution):
                self.assertEqual(mod.ensure_capture_runtime(root),"ready")
            self.assertEqual(len(seen),5)
            self.assertEqual(seen[2][:2],["npm","install"])
            self.assertIn("playwright@1.56.1",seen[2])
            self.assertIn("--no-save",seen[2])
            self.assertIn("--ignore-scripts",seen[2])
            self.assertEqual(seen[3][:3],["npx","--no-install","playwright"])

    def test_capture_provisioning_defers_during_actual_recording(self):
        with TemporaryDirectory() as temp:
            root=Path(temp)
            (root / "cycle-browser.mjs").write_text("fixture")
            with patch.object(mod,"busy_capture",return_value=True),patch.object(mod,"run") as execute:
                self.assertIn("deferred",mod.ensure_capture_runtime(root))
                execute.assert_not_called()

    def test_nonexistent_playwright_module_configuration_is_not_ignored(self):
        with TemporaryDirectory() as temp:
            root=Path(temp)
            (root / "cycle-browser.mjs").write_text("fixture")
            with patch.dict(mod.os.environ,{"PLAYWRIGHT_MODULE":str(root/"not-here.mjs")}), \
                 patch.object(mod,"run") as execute:
                self.assertIn("PLAYWRIGHT_MODULE",mod.ensure_capture_runtime(root))
                execute.assert_not_called()

    def test_preview_admits_only_private_owner_origin_main_base(self):
        sha="a"*40
        valid={"state":"open","merged_at":None,
            "head":{"sha":sha,"ref":mod.CINEMA_PREVIEW_BRANCH,
                    "repo":{"full_name":"YasmindIess/continuity-cinema"}},
            "base":{"ref":"main",
                    "repo":{"full_name":"YasmindIess/continuity-cinema"}}}
        self.assertEqual(mod.admitted_preview_head(valid),sha)
        fork={**valid,"head":{**valid["head"],"repo":{"full_name":"other/fork"}}}
        with self.assertRaisesRegex(RuntimeError,"foreign or fork"):
            mod.admitted_preview_head(fork)
        wrong={**valid,"head":{**valid["head"],"sha":"not-a-real-sha"}}
        with self.assertRaisesRegex(RuntimeError,"valid full head SHA"):
            mod.admitted_preview_head(wrong)
        closed={**valid,"state":"closed"}
        with self.assertRaisesRegex(RuntimeError,"closed or merged"):
            mod.admitted_preview_head(closed)
        redirected={**valid,"base":{"ref":"feature","repo":{"full_name":"YasmindIess/continuity-cinema"}}}
        with self.assertRaisesRegex(RuntimeError,"preview branch or base"):
            mod.admitted_preview_head(redirected)

    def test_preview_fetch_never_precedes_exact_head_ci(self):
        # A missing / non-green exact-head CI must be held before Git or npm mutation.
        with TemporaryDirectory() as td:
            main=Path(td)/"cinema-main"
            (main/".git").mkdir(parents=True)
            calls=[]
            def fake_run(cmd,cwd,timeout=35):
                calls.append(cmd)
                if cmd[1:4]==["remote","get-url","origin"]:
                    return "https://github.com/YasmindIess/continuity-cinema.git"
                if cmd[1:3]==["branch","--show-current"]:
                    return "main"
                if cmd[1:3]==["status","--porcelain"]:
                    return ""
                if cmd[:2]==["gh","api"]:
                    return '{"state":"open","merged_at":null,"head":{"sha":"'+("a"*40)+'","ref":"'+mod.CINEMA_PREVIEW_BRANCH+'","repo":{"full_name":"YasmindIess/continuity-cinema"}},"base":{"ref":"main","repo":{"full_name":"YasmindIess/continuity-cinema"}}}'
                raise AssertionError("unexpected side effect before CI: "+str(cmd))
            with patch.object(mod,"MANAGED_CINEMA",main), \
                 patch.object(mod,"run",side_effect=fake_run), \
                 patch.object(mod,"exact_ci",side_effect=RuntimeError("CI not green")):
                with self.assertRaisesRegex(RuntimeError,"CI not green"):
                    mod.prepare_cinema_preview()
            self.assertTrue(any(cmd[:2]==["gh","api"] for cmd in calls))
            self.assertFalse(any("fetch" in cmd or "npm" in cmd for cmd in calls))

    def test_real_http_build_identity_not_inferred_from_source_checkout(self):
        from types import SimpleNamespace
        class Payload:
            def __enter__(self): return self
            def __exit__(self,*_): return False
        class Build(Payload):
            def __init__(self,raw): self.raw=raw
            def read(self): return self.raw.encode()
        correct=('{"schema":"cinema-live-build-v1","version":"0.7.0",'
                 '"source_mode":"github-preview","source_commit":"'+("a"*40)+'",'
                 '"userscript_served":true}')
        with patch.object(mod.urllib.request,"urlopen",return_value=Build(correct)):
            observed=mod.observed_cinema_build()
        self.assertEqual(observed["state"],"verified")
        self.assertEqual(observed["source_mode"],"github-preview")
        self.assertEqual(observed["source_commit"],"a"*40)
        wrong='{"schema":"cinema-live-build-v1","version":"0.7.0","source_mode":"github-preview","source_commit":null,"userscript_served":true}'
        with patch.object(mod.urllib.request,"urlopen",return_value=Build(wrong)):
            self.assertEqual(mod.observed_cinema_build()["state"],"unverified")

    def test_old_cinema_route_404_proves_no_new_userscript_route(self):
        from urllib.error import HTTPError
        with patch.object(mod.urllib.request,"urlopen",
                          side_effect=HTTPError("http://127.0.0.1:8765/api/build",404,"not found",{},None)):
            result=mod.observed_cinema_build()
        self.assertEqual(result["state"],"legacy-route-missing")
        self.assertEqual(result["source_mode"],"legacy")

    def test_missing_exact_head_ci_fails_closed(self):
        with patch.object(mod.shutil, "which", return_value="/usr/bin/gh"), \
             patch.object(mod, "run", return_value='{"workflow_runs": []}'):
            with self.assertRaisesRegex(RuntimeError, "no exact-head"):
                mod.exact_ci("YasmindIess/bi-ble", "a" * 40, Path("/tmp"))

    def test_pending_ci_is_not_mistaken_for_failure_or_success(self):
        data='{"workflow_runs":[{"head_sha":"'+("a"*40)+'","event":"push","workflow_id":11,"name":"Cinema verify","id":123,"created_at":"2026-10-09T20:00:00Z","status":"queued","conclusion":null}]}'
        with patch.object(mod.shutil, "which", return_value="/usr/bin/gh"), \
             patch.object(mod, "run", return_value=data):
            with self.assertRaisesRegex(RuntimeError, "CI pending: Cinema verify run 123"):
                mod.exact_ci("YasmindIess/continuity-cinema", "a"*40, Path("/tmp"))

    def test_failed_ci_includes_conclusion_and_run_id(self):
        data='{"workflow_runs":[{"head_sha":"'+("a"*40)+'","event":"push","workflow_id":11,"name":"Cinema verify","id":124,"created_at":"2026-10-09T20:00:00Z","status":"completed","conclusion":"failure"}]}'
        with patch.object(mod.shutil, "which", return_value="/usr/bin/gh"), \
             patch.object(mod, "run", return_value=data):
            with self.assertRaisesRegex(RuntimeError, "CI not passed: Cinema verify run 124"):
                mod.exact_ci("YasmindIess/continuity-cinema", "a"*40, Path("/tmp"))

    def test_successful_ci_can_admit_exact_head(self):
        data='{"workflow_runs":[{"head_sha":"'+("a"*40)+'","event":"push","workflow_id":11,"name":"Cinema verify","id":125,"created_at":"2026-10-09T20:00:00Z","status":"completed","conclusion":"success"}]}'
        with patch.object(mod.shutil, "which", return_value="/usr/bin/gh"), \
             patch.object(mod, "run", return_value=data):
            self.assertEqual(mod.exact_ci("YasmindIess/continuity-cinema", "a"*40, Path("/tmp")),1)

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
             patch.object(mod.urllib.request, "urlopen", side_effect=lambda *args, **kwargs: io.BytesIO(b'{"status":"idle"}')):
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
