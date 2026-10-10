"""Offline guard tests: migrate program files only, not captures or secrets."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch

spec = spec_from_file_location("adopt_cinema_under_test", Path(__file__).with_name("adopt_cinema.py"))
adopt = module_from_spec(spec)
spec.loader.exec_module(adopt)


class CinemaAdoptionGuards(TestCase):
    def test_only_allowlisted_program_sources(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            for name in ("server.mjs", "cycle-browser.mjs", "run-local.sh",
                         "package.json", "index.html", ".gitignore"):
                (root / name).write_text("safe")
            (root / "captures").mkdir()
            (root / "captures" / "private.png").write_bytes(b"PRIVATE")
            (root / ".env").write_text("SECRET=private")
            (root / "edge-read.env").write_text("SECRET=private")
            (root / "userscripts").mkdir()
            (root / "userscripts" / "continuity-cinema-bridge.user.js").write_text("safe")
            with patch.object(adopt, "LEGACY", root):
                selected = {str(x.relative_to(root)) for x in adopt.select_sources()}
            self.assertIn("server.mjs", selected)
            self.assertIn("userscripts/continuity-cinema-bridge.user.js", selected)
            self.assertNotIn(".env", selected)
            self.assertNotIn("edge-read.env", selected)
            self.assertNotIn("captures/private.png", selected)

    def test_private_key_fails_closed(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            for name in ("server.mjs", "cycle-browser.mjs", "run-local.sh", "package.json"):
                (root / name).write_text("safe")
            (root / "server.mjs").write_text("-----BEGIN PRIVATE KEY-----")
            with patch.object(adopt, "LEGACY", root):
                with self.assertRaisesRegex(RuntimeError, "sensitive"):
                    adopt.select_sources()

    def test_missing_private_repo_is_adoptable_for_authorized_owner(self):
        from types import SimpleNamespace
        def fake_command(argv, cwd=None, timeout=120):
            if argv[:3] == ["gh", "api", "user"]:
                return "YasmindIess"
            return ""
        with patch.object(adopt, "command", side_effect=fake_command), \
             patch.object(adopt.subprocess, "run", return_value=SimpleNamespace(
                 returncode=1, stderr="gh: Not Found (HTTP 404)", stdout="")):
            adopt.verify_private_target_unclaimed()

    def test_existing_private_repo_is_not_overwritten(self):
        from types import SimpleNamespace
        with patch.object(adopt, "command", return_value="YasmindIess"), \
             patch.object(adopt.subprocess, "run", return_value=SimpleNamespace(
                 returncode=0, stderr="", stdout="{}")):
            with self.assertRaisesRegex(RuntimeError, "already exists"):
                adopt.verify_private_target_unclaimed()

    def test_other_gh_failure_does_not_look_like_missing_repo(self):
        from types import SimpleNamespace
        with patch.object(adopt, "command", return_value="YasmindIess"), \
             patch.object(adopt.subprocess, "run", return_value=SimpleNamespace(
                 returncode=1, stderr="gh: Forbidden (HTTP 403)", stdout="")):
            with self.assertRaisesRegex(RuntimeError, "not a 404"):
                adopt.verify_private_target_unclaimed()

    def test_synthetic_png_has_required_magic_bytes(self):
        self.assertEqual(adopt.synthetic_png()[:8], bytes([137,80,78,71,13,10,26,10]))

    def test_missing_application_does_not_adopt(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "server.mjs").write_text("safe")
            with patch.object(adopt, "LEGACY", root):
                with self.assertRaisesRegex(RuntimeError, "Required application"):
                    adopt.select_sources()


if __name__ == "__main__":
    main()
