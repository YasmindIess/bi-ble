"""Tests: direct loopback telemetry is redacted, fresh, read-only and independent of Cinema."""
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

import conductor_telemetry as telemetry


class IndependentObservatoryTests(TestCase):
    def sample(self):
        return {
            "schema": "blochfield-live-conductor-v1",
            "checked_at": "2026-10-10T10:20:00-0300",
            "secret_token": "TOP_SECRET_NEVER_SEND",
            "repos": [
                {"name": "bi-ble", "branch": "feat/continuity-handoff-v1",
                 "head": "a" * 40, "state": "current",
                 "private_env": "TOP_SECRET_NEVER_SEND"},
                {"name": "cinema", "branch": "main",
                 "head": "b" * 40, "state": "held",
                 "reason": "CI pending: Cinema verify run 123 (queued)"},
                {"name": "other-project", "name_or_secret": "TOP_SECRET_NEVER_SEND",
                 "head": "c" * 40, "state": "current"}
            ],
            "cinema": "owned", "vite": "owned",
            "cinema_source": "legacy",
            "cinema_capture_runtime": "held: browser dependencies missing",
            "cinema_preview": {
                "state": "held", "locally_admitted": False,
                "reason": "CI not passed", "head": None,
                "absolute_path": "/private/should/never/show"
            },
            "cinema_live_build": {
                "state": "legacy-route-missing",
                "source_mode": "legacy",
                "reason": "Old Cinema lacks /api/build"
            },
            "CINEMA_EDGE_WRITE_KEY": "TOP_SECRET_NEVER_SEND"
        }

    def test_allowlisted_fields_and_real_heartbeat(self):
        clock = datetime(2026, 10, 10, 13, 20, 15, tzinfo=timezone.utc)
        result = telemetry.snapshot(self.sample(), clock)
        raw = json.dumps(result)
        self.assertEqual(result["transport"], "conductor-direct-loopback")
        self.assertEqual(result["supervisor"]["state"], "responsive")
        self.assertEqual(result["supervisor"]["heartbeat_age_ms"], 15000)
        self.assertEqual(len(result["projects"]), 2)
        self.assertEqual(result["projects"][1]["state"], "held")
        self.assertEqual(result["capture_runtime"], "held: browser dependencies missing")
        self.assertEqual(result["live_build"]["state"], "legacy-route-missing")
        self.assertFalse(result["independent_witness"])
        self.assertFalse(result["release_authorized"])
        self.assertNotIn("TOP_SECRET_NEVER_SEND", raw)
        self.assertNotIn("/private/should/never/show", raw)

    def test_stale_and_unavailable_are_not_rendered_as_healthy(self):
        clock = datetime(2026, 10, 10, 13, 24, tzinfo=timezone.utc)
        self.assertEqual(telemetry.snapshot(self.sample(), clock)["supervisor"]["state"], "stale")
        self.assertEqual(telemetry.snapshot({})["supervisor"]["state"], "unknown")

    def test_corrupted_status_does_not_create_claimed_facts(self):
        with TemporaryDirectory() as td:
            p = Path(td)/"status.json"
            self.assertEqual(telemetry.read_status(p), {})
            p.write_text("{not json")
            self.assertEqual(telemetry.read_status(p), {})
            p.write_text(json.dumps(self.sample()))
            self.assertEqual(telemetry.read_status(p)["cinema"], "owned")

    def test_pinned_private_userscript_requires_exact_admission(self):
        with TemporaryDirectory() as td:
            base = Path(td)
            state = base/"status.json"
            root = base/"previews"
            head = "a"*40
            script = root/head/"userscripts"/"continuity-cinema-bridge.user.js"
            script.parent.mkdir(parents=True)
            script.write_text("// ==UserScript==\\n// @version 0.7.4\\n// ==/UserScript==\\n")
            digest=hashlib.sha256(script.read_bytes()).hexdigest()
            self.assertIsNone(telemetry.verified_userscript(state, root))
            state.with_name("userscript.json").write_text(json.dumps({
                "schema":"bxr-ci-admitted-userscript-v1",
                "ci_admitted":True,"head":head,"content_sha256":digest}))
            self.assertTrue(telemetry.verified_userscript(state,root).startswith(b"// ==UserScript=="))
            original=script.read_bytes()
            script.write_bytes(original+b"// tampered")
            self.assertIsNone(telemetry.verified_userscript(state,root))
            script.write_bytes(original)
            state.with_name("userscript.json").write_text(json.dumps({
                "schema":"bxr-ci-admitted-userscript-v1",
                "ci_admitted":True,"head":"../secret","content_sha256":digest}))
            self.assertIsNone(telemetry.verified_userscript(state,root))
            state.with_name("userscript.json").write_text(json.dumps({
                "schema":"bxr-ci-admitted-userscript-v1",
                "ci_admitted":False,"head":head,"content_sha256":digest}))
            self.assertIsNone(telemetry.verified_userscript(state,root))
            script.unlink()
            script.symlink_to("/etc/passwd")
            state.with_name("userscript.json").write_text(json.dumps({
                "schema":"bxr-ci-admitted-userscript-v1",
                "ci_admitted":True,"head":head,"content_sha256":digest}))
            self.assertIsNone(telemetry.verified_userscript(state,root))

    def test_loopback_api_refuses_mutation_and_unknown_paths(self):
        with TemporaryDirectory() as td:
            p = Path(td)/"status.json"
            p.write_text(json.dumps(self.sample()))
            script_root = Path(td)/"previews"
            head = "b"*40
            script = script_root/head/"userscripts"/"continuity-cinema-bridge.user.js"
            script.parent.mkdir(parents=True)
            script.write_text("// ==UserScript==\\n// @version 0.7.4\\n// ==/UserScript==\\n")
            server = telemetry.start(p, port=0, script_root=script_root)
            try:
                self.assertEqual(server.server_address[0], "127.0.0.1")
                base = f"http://127.0.0.1:{server.server_address[1]}"
                with urlopen(base+"/api/observatory", timeout=2) as response:
                    payload = json.load(response)
                    self.assertEqual(response.headers.get("Access-Control-Allow-Origin"), None)
                    self.assertEqual(payload["schema"], "cinema-observatory-v1")
                    self.assertEqual(payload["projects"][0]["name"], "bi-ble")
                script_url=base+"/userscripts/continuity-cinema-bridge.user.js"
                with self.assertRaises(HTTPError) as pending:
                    urlopen(script_url, timeout=2)
                self.assertEqual(pending.exception.code,404)
                p.with_name("userscript.json").write_text(json.dumps({
                    "schema":"bxr-ci-admitted-userscript-v1",
                    "ci_admitted":True,
                    "head":head,
                    "content_sha256":hashlib.sha256(script.read_bytes()).hexdigest()}))
                with urlopen(script_url,timeout=2) as approved:
                    self.assertTrue(approved.read().startswith(b"// ==UserScript=="))
                    self.assertIn("javascript",approved.headers.get("Content-Type"))
                script.write_bytes(script.read_bytes()+b"tamper")
                with self.assertRaises(HTTPError) as invalid:
                    urlopen(script_url,timeout=2)
                self.assertEqual(invalid.exception.code,404)
                with self.assertRaises(HTTPError) as missing:
                    urlopen(base+"/userscripts/private.env", timeout=2)
                self.assertEqual(missing.exception.code, 404)
                with self.assertRaises(HTTPError) as denied:
                    urlopen(Request(base+"/api/observatory", method="POST", data=b"{}"), timeout=2)
                self.assertEqual(denied.exception.code, 405)
            finally:
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    main()
