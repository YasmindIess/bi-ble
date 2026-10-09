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

    def test_missing_application_does_not_adopt(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "server.mjs").write_text("safe")
            with patch.object(adopt, "LEGACY", root):
                with self.assertRaisesRegex(RuntimeError, "Required application"):
                    adopt.select_sources()


if __name__ == "__main__":
    main()
