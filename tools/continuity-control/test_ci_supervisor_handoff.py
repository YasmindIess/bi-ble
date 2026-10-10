"""Pure safety regression checks for the operator-run conductor handoff."""
import importlib.util
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch

file=Path(__file__).with_name("ci_supervisor_handoff.py")
spec=importlib.util.spec_from_file_location("conductor_handoff",file)
handoff=importlib.util.module_from_spec(spec)
spec.loader.exec_module(handoff)

SHA="f"*40
class HandoffSafetyTests(TestCase):
    def test_exact_pr_head_and_green_run_are_both_required(self):
        pr={"state":"open","merged_at":None,
            "head":{"sha":SHA,"ref":handoff.BRANCH,"repo":{"full_name":handoff.REPO}}}
        good={"workflow_runs":[{"head_sha":SHA,"event":"pull_request",
            "workflow_id":99,"created_at":"2026-10-10T14:00:00Z",
            "status":"completed","conclusion":"success"}]}
        with patch.object(handoff,"gh_json",side_effect=[pr,good]):
            self.assertEqual(handoff.gh_gate(SHA),1)
        with patch.object(handoff,"gh_json",return_value={
                **pr,"head":{**pr["head"],"sha":"b"*40}}):
            with self.assertRaisesRegex(handoff.Held,"not current"):
                handoff.gh_gate(SHA)
        with patch.object(handoff,"gh_json",side_effect=[pr,{
            **good,"workflow_runs":[{**good["workflow_runs"][0],"status":"in_progress","conclusion":None}]}]):
            with self.assertRaisesRegex(handoff.Held,"not entirely green"):
                handoff.gh_gate(SHA)
        with self.assertRaisesRegex(handoff.Held,"Invalid exact-head"):
            handoff.gh_gate("../../unsafe")

    def test_running_capture_fails_closed(self):
        for bad in ("running","publishing","unknown"):
            with patch.object(handoff,"remote_json",side_effect=[
                    {"status":bad},{"status":"passed"}]):
                with self.assertRaises(handoff.Held):
                    handoff.ensure_idle()

    def test_pending_runner_refuses_handoff_without_signalling_supervisor(self):
        status={"schema":"blochfield-live-conductor-v1","supervisor_pid":42,
                "cinema":"owned","vite":"owned"}
        with patch.object(handoff,"gh_gate",return_value=1), \
             patch.object(handoff,"state",return_value=status), \
             patch.object(handoff,"identity",return_value=[]), \
             patch.object(handoff,"runner_busy",return_value=True), \
             patch.object(handoff.os,"kill") as killer:
            with self.assertRaisesRegex(handoff.Held,"Runner.Worker"):
                handoff.handoff(SHA,True)
            killer.assert_not_called()

    def test_read_only_gate_performs_no_clone_or_kill(self):
        status={"schema":"blochfield-live-conductor-v1","supervisor_pid":42,
                "cinema":"owned","vite":"owned"}
        def run(cmd,cwd=None,timeout=35):
            self.assertIn("status",cmd)
            return " M protected-user-file"
        with patch.object(handoff,"gh_gate",return_value=1), \
             patch.object(handoff,"state",return_value=status), \
             patch.object(handoff,"identity",return_value=[]), \
             patch.object(handoff,"runner_busy",return_value=False), \
             patch.object(handoff,"ensure_idle",return_value=(None,None,"idle","idle")), \
             patch.object(handoff,"run",side_effect=run), \
             patch.object(handoff,"create_clean_parallel_checkout") as clone, \
             patch.object(handoff.os,"kill") as killer:
            handoff.handoff(SHA,False)
            clone.assert_not_called()
            killer.assert_not_called()

    def test_changed_checkout_refuses_handoff_without_signal(self):
        status={"schema":"blochfield-live-conductor-v1","supervisor_pid":42,
                "cinema":"owned","vite":"owned"}
        with patch.object(handoff,"gh_gate",return_value=1), \
             patch.object(handoff,"state",return_value=status), \
             patch.object(handoff,"identity",return_value=[]), \
             patch.object(handoff,"runner_busy",return_value=False), \
             patch.object(handoff,"ensure_idle",return_value=(None,None,"idle","idle")), \
             patch.object(handoff,"run",side_effect=[" M old-user-file"," M changed-user-file"]), \
             patch.object(handoff,"create_clean_parallel_checkout",return_value=Path("/tmp/release/live_supervisor.py")), \
             patch.object(handoff.os,"kill") as killer:
            with self.assertRaisesRegex(handoff.Held,"working tree changed"):
                handoff.handoff(SHA,True)
            killer.assert_not_called()

if __name__=="__main__":main()
