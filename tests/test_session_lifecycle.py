import importlib.util
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from importlib.machinery import SourceFileLoader
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_loader("cdx_module_lifecycle", SourceFileLoader("cdx_module_lifecycle", str(ROOT / "cdx")))
cdx = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = cdx
SPEC.loader.exec_module(cdx)


class Completed:
    def __init__(self, returncode: int = 0, stdout: str = "", stderr: str = ""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def session_record(name: str, *, closed_at: str | None = None) -> dict:
    return {
        "id": name[:3] + "123",
        "name": name,
        "tmux_session": f"cdx_{name[:3]}123",
        "codex_session_id": f"codex-{name}",
        "last_cwd": "/tmp",
        "created_at": "2026-05-12T00:00:00Z",
        "updated_at": "2026-05-12T00:00:00Z",
        "last_used_at": "2026-05-12T00:00:00Z",
        "last_viewed_at": "2026-05-12T00:00:00Z",
        "transcript_path": None,
        "closed_at": closed_at,
    }


class SessionLifecycleTests(unittest.TestCase):
    def test_fork_creates_pending_cdx_session_from_source_codex_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            registry_path = Path(tmp) / "sessions.json"
            lock_path = Path(tmp) / "lock"
            source = session_record("source")
            source["codex_session_id"] = "019e3f90-209d-71f0-ad82-9739a8b6f9be"
            source["last_cwd"] = tmp
            registry_path.write_text(
                json.dumps({"version": cdx.VERSION, "sessions": [source]}),
                encoding="utf-8",
            )
            old_registry_path = cdx.REGISTRY_PATH
            old_lock_path = cdx.LOCK_PATH
            old_require_tool = cdx.require_tool
            old_tmux_exists = cdx.tmux_exists
            cdx.REGISTRY_PATH = registry_path
            cdx.LOCK_PATH = lock_path
            cdx.require_tool = lambda _name: None
            cdx.tmux_exists = lambda _name: False
            try:
                output = io.StringIO()
                with redirect_stdout(output):
                    rc = cdx.cmd_fork(["--json", "--no-enter", "source", "source fork"])
            finally:
                cdx.REGISTRY_PATH = old_registry_path
                cdx.LOCK_PATH = old_lock_path
                cdx.require_tool = old_require_tool
                cdx.tmux_exists = old_tmux_exists

            self.assertEqual(rc, 0)
            data = json.loads(output.getvalue())
            self.assertTrue(data["ok"])
            self.assertEqual(data["session"]["name"], "source fork")
            self.assertIsNone(data["session"]["codex_session_id"])
            self.assertEqual(data["session"]["fork_from_codex_session_id"], "019e3f90-209d-71f0-ad82-9739a8b6f9be")
            self.assertEqual(data["session"]["fork_from_cdx_id"], source["id"])
            saved = json.loads(registry_path.read_text(encoding="utf-8"))["sessions"]
            self.assertEqual([session["name"] for session in saved], ["source", "source fork"])

    def test_hook_binding_clears_pending_fork_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            registry_path = Path(tmp) / "sessions.json"
            lock_path = Path(tmp) / "lock"
            forked = session_record("forked")
            forked["codex_session_id"] = None
            forked["fork_from_codex_session_id"] = "019e3f90-209d-71f0-ad82-9739a8b6f9be"
            forked["fork_from_cdx_id"] = "src123"
            registry_path.write_text(
                json.dumps({"version": cdx.VERSION, "sessions": [forked]}),
                encoding="utf-8",
            )
            old_registry_path = cdx.REGISTRY_PATH
            old_lock_path = cdx.LOCK_PATH
            old_find_transcript = cdx.find_codex_transcript_path
            old_is_subagent = cdx.transcript_is_subagent
            cdx.REGISTRY_PATH = registry_path
            cdx.LOCK_PATH = lock_path
            cdx.find_codex_transcript_path = lambda _codex_id: None
            cdx.transcript_is_subagent = lambda _path: False
            try:
                bound = cdx.bind_cdx_session_to_codex_id(forked["id"], "019e4077-f917-7000-94d3-353734c05d1c", source="test")
            finally:
                cdx.REGISTRY_PATH = old_registry_path
                cdx.LOCK_PATH = old_lock_path
                cdx.find_codex_transcript_path = old_find_transcript
                cdx.transcript_is_subagent = old_is_subagent

            self.assertTrue(bound)
            saved = json.loads(registry_path.read_text(encoding="utf-8"))["sessions"][0]
            self.assertEqual(saved["codex_session_id"], "019e4077-f917-7000-94d3-353734c05d1c")
            self.assertNotIn("fork_from_codex_session_id", saved)
            self.assertNotIn("fork_from_cdx_id", saved)

    def test_close_soft_closes_session_and_kills_live_tmux(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            registry_path = Path(tmp) / "sessions.json"
            lock_path = Path(tmp) / "lock"
            registry_path.write_text(
                json.dumps({"version": cdx.VERSION, "sessions": [session_record("demo")]}),
                encoding="utf-8",
            )
            calls: list[list[str]] = []
            old_registry_path = cdx.REGISTRY_PATH
            old_lock_path = cdx.LOCK_PATH
            old_tmux_exists = cdx.tmux_exists
            old_run = cdx.subprocess.run
            cdx.REGISTRY_PATH = registry_path
            cdx.LOCK_PATH = lock_path
            cdx.tmux_exists = lambda name: name == "cdx_dem123"
            cdx.subprocess.run = lambda args, **_kwargs: calls.append(list(args)) or Completed()
            try:
                output = io.StringIO()
                with redirect_stdout(output):
                    rc = cdx.cmd_close(["--json", "--yes", "demo"])
            finally:
                cdx.REGISTRY_PATH = old_registry_path
                cdx.LOCK_PATH = old_lock_path
                cdx.tmux_exists = old_tmux_exists
                cdx.subprocess.run = old_run

            self.assertEqual(rc, 0)
            data = json.loads(output.getvalue())
            self.assertTrue(data["ok"])
            self.assertTrue(data["killed_tmux"])
            self.assertTrue(data["session"]["closed"])
            saved = json.loads(registry_path.read_text(encoding="utf-8"))["sessions"]
            self.assertEqual(len(saved), 1)
            self.assertEqual(saved[0]["codex_session_id"], "codex-demo")
            self.assertIsNotNone(saved[0]["closed_at"])
            self.assertIn(["tmux", "kill-session", "-t", "cdx_dem123"], calls)

    def test_list_hides_closed_sessions_and_history_lists_them(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            registry_path = Path(tmp) / "sessions.json"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": cdx.VERSION,
                        "sessions": [
                            session_record("active"),
                            session_record("closed", closed_at="2026-05-20T01:02:03Z"),
                        ],
                    }
                ),
                encoding="utf-8",
            )
            old_registry_path = cdx.REGISTRY_PATH
            old_tmux_exists = cdx.tmux_exists
            cdx.REGISTRY_PATH = registry_path
            cdx.tmux_exists = lambda _name: False
            try:
                list_output = io.StringIO()
                with redirect_stdout(list_output):
                    list_rc = cdx.cmd_list(["--json"])
                history_output = io.StringIO()
                with redirect_stdout(history_output):
                    history_rc = cdx.cmd_history(["--json"])
            finally:
                cdx.REGISTRY_PATH = old_registry_path
                cdx.tmux_exists = old_tmux_exists

            self.assertEqual(list_rc, 0)
            self.assertEqual(history_rc, 0)
            listed = json.loads(list_output.getvalue())["sessions"]
            history = json.loads(history_output.getvalue())["sessions"]
            self.assertEqual([s["name"] for s in listed], ["active"])
            self.assertEqual([s["name"] for s in history], ["closed"])
            self.assertEqual(history[0]["closed_at"], "2026-05-20T01:02:03Z")

    def test_reopen_restores_closed_session_without_enter_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            registry_path = Path(tmp) / "sessions.json"
            lock_path = Path(tmp) / "lock"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": cdx.VERSION,
                        "sessions": [session_record("closed", closed_at="2026-05-20T01:02:03Z")],
                    }
                ),
                encoding="utf-8",
            )
            entered: list[str] = []
            old_registry_path = cdx.REGISTRY_PATH
            old_lock_path = cdx.LOCK_PATH
            old_enter_session = cdx.enter_session
            cdx.REGISTRY_PATH = registry_path
            cdx.LOCK_PATH = lock_path
            cdx.enter_session = lambda session, *, unbound_mode="prompt": entered.append(session["name"]) or 0
            try:
                output = io.StringIO()
                with redirect_stdout(output):
                    rc = cdx.cmd_reopen(["--json", "closed"])
            finally:
                cdx.REGISTRY_PATH = old_registry_path
                cdx.LOCK_PATH = old_lock_path
                cdx.enter_session = old_enter_session

            self.assertEqual(rc, 0)
            data = json.loads(output.getvalue())
            self.assertTrue(data["ok"])
            self.assertFalse(data["entered"])
            self.assertFalse(data["session"]["closed"])
            saved = json.loads(registry_path.read_text(encoding="utf-8"))["sessions"][0]
            self.assertNotIn("closed_at", saved)
            self.assertEqual(entered, [])


if __name__ == "__main__":
    unittest.main()
