import importlib.util
import json
import sys
import tempfile
import unittest
from importlib.machinery import SourceFileLoader
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_loader("cdx_module_tmux", SourceFileLoader("cdx_module_tmux", str(ROOT / "cdx")))
cdx = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = cdx
SPEC.loader.exec_module(cdx)

EXPECTED_HISTORY_LIMIT = "200000"


class Completed:
    def __init__(self, returncode: int = 0, stdout: str = "", stderr: str = ""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class TmuxHistoryTests(unittest.TestCase):
    def test_configure_tmux_session_sets_large_history_limit(self) -> None:
        calls: list[list[str]] = []
        old_which = cdx.shutil.which
        old_run = cdx.subprocess.run
        cdx.shutil.which = lambda name: f"/usr/bin/{name}" if name == "tmux" else old_which(name)
        cdx.subprocess.run = lambda args, **_kwargs: calls.append(list(args)) or Completed()
        try:
            cdx.configure_tmux_session("cdx_demo")
        finally:
            cdx.shutil.which = old_which
            cdx.subprocess.run = old_run

        self.assertIn(
            ["tmux", "set-option", "-q", "-t", "cdx_demo", "history-limit", EXPECTED_HISTORY_LIMIT],
            calls,
        )

    def test_new_tmux_session_configures_history_before_starting_runner(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            registry_path = tmp_path / "sessions.json"
            lock_path = tmp_path / "lock"
            cwd = tmp_path / "repo"
            cwd.mkdir()
            registry_path.write_text(
                json.dumps(
                    {
                        "version": cdx.VERSION,
                        "sessions": [
                            {
                                "id": "abc123",
                                "name": "demo",
                                "tmux_session": "cdx_abc123",
                                "codex_session_id": "codex-1",
                                "last_cwd": str(cwd),
                                "created_at": "2026-05-12T00:00:00Z",
                                "updated_at": "2026-05-12T00:00:00Z",
                                "last_used_at": "2026-05-12T00:00:00Z",
                                "last_viewed_at": "2026-05-12T00:00:00Z",
                                "transcript_path": None,
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            calls: list[list[str]] = []
            old_registry_path = cdx.REGISTRY_PATH
            old_lock_path = cdx.LOCK_PATH
            old_require_tool = cdx.require_tool
            old_tmux_exists = cdx.tmux_exists
            old_which = cdx.shutil.which
            old_run = cdx.subprocess.run
            cdx.REGISTRY_PATH = registry_path
            cdx.LOCK_PATH = lock_path
            cdx.require_tool = lambda _name: None
            cdx.tmux_exists = lambda _name: False
            cdx.shutil.which = lambda name: f"/usr/bin/{name}" if name == "tmux" else old_which(name)
            cdx.subprocess.run = lambda args, **_kwargs: calls.append(list(args)) or Completed()
            try:
                created = cdx.create_tmux_if_needed(cdx.load_registry()["sessions"][0])
            finally:
                cdx.REGISTRY_PATH = old_registry_path
                cdx.LOCK_PATH = old_lock_path
                cdx.require_tool = old_require_tool
                cdx.tmux_exists = old_tmux_exists
                cdx.shutil.which = old_which
                cdx.subprocess.run = old_run

            self.assertTrue(created)
            new_session_call = next(call for call in calls if call[:3] == ["tmux", "new-session", "-d"])
            self.assertNotIn("__runner", " ".join(new_session_call))

            history_index = calls.index(
                ["tmux", "set-option", "-q", "-t", "cdx_abc123", "history-limit", EXPECTED_HISTORY_LIMIT]
            )
            send_keys_index = next(i for i, call in enumerate(calls) if call[:4] == ["tmux", "send-keys", "-t", "cdx_abc123"])
            self.assertLess(history_index, send_keys_index)
            self.assertIn("__runner abc123", calls[send_keys_index][-2])


if __name__ == "__main__":
    unittest.main()
