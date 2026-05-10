import importlib.util
import sys
import tempfile
import unittest
from importlib.machinery import SourceFileLoader
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_loader("cdx_module_hooks", SourceFileLoader("cdx_module_hooks", str(ROOT / "cdx")))
cdx = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = cdx
SPEC.loader.exec_module(cdx)


class HooksFeatureTests(unittest.TestCase):
    def with_config(self, text: str, action):
        with tempfile.TemporaryDirectory() as tmp:
            config = Path(tmp) / "config.toml"
            if text is not None:
                config.write_text(text, encoding="utf-8")
            old_home = cdx.CODEX_HOME
            old_config = cdx.CODEX_CONFIG_PATH
            cdx.CODEX_HOME = Path(tmp)
            cdx.CODEX_CONFIG_PATH = config
            try:
                return action(config)
            finally:
                cdx.CODEX_HOME = old_home
                cdx.CODEX_CONFIG_PATH = old_config

    def test_feature_enabled_uses_hooks_key(self) -> None:
        def check(_config: Path) -> bool:
            return cdx.is_feature_enabled()

        self.assertTrue(self.with_config("[features]\nhooks = true\n", check))

    def test_legacy_codex_hooks_key_is_not_enough(self) -> None:
        def check(_config: Path) -> bool:
            return cdx.is_feature_enabled()

        self.assertFalse(self.with_config("[features]\ncodex_hooks = true\n", check))

    def test_enable_feature_replaces_legacy_codex_hooks_key(self) -> None:
        def migrate(config: Path) -> str:
            cdx.enable_codex_hooks_feature()
            return config.read_text(encoding="utf-8")

        text = self.with_config("[features]\ncodex_hooks = true\nplugins = true\n", migrate)

        self.assertIn("hooks = true", text)
        self.assertIn("plugins = true", text)
        self.assertNotIn("codex_hooks", text)

    def test_enable_feature_creates_features_table(self) -> None:
        def migrate(config: Path) -> str:
            cdx.enable_codex_hooks_feature()
            return config.read_text(encoding="utf-8")

        text = self.with_config("model = \"gpt-5.2\"\n", migrate)

        self.assertIn("[features]\nhooks = true", text)


if __name__ == "__main__":
    unittest.main()
