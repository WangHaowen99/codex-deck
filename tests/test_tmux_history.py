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
SPEC = importlib.util.spec_from_loader("cdx_module_tmux", SourceFileLoader("cdx_module_tmux", str(ROOT / "cdx")))
cdx = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = cdx
SPEC.loader.exec_module(cdx)

EXPECTED_HISTORY_LIMIT = "200000"
EXPECTED_SCROLL_LINES = "12"


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

    def test_configure_tmux_session_uses_accelerated_mobile_scroll(self) -> None:
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

        self.assertIn(["tmux", "set-option", "-q", "-t", "cdx_demo", "mouse", "on"], calls)
        self.assertIn(["tmux", "set-option", "-q", "-t", "cdx_demo", "@cdx_scroll_mode", "accelerated-copy-mode"], calls)
        wheel_up = " ".join(next(call for call in calls if call[:5] == ["tmux", "bind-key", "-T", "root", "WheelUpPane"]))
        wheel_down = " ".join(next(call for call in calls if call[:5] == ["tmux", "bind-key", "-T", "root", "WheelDownPane"]))
        self.assertIn(f"-N {EXPECTED_SCROLL_LINES} scroll-up", wheel_up)
        self.assertIn(f"-N {EXPECTED_SCROLL_LINES} scroll-down", wheel_down)
        self.assertIn("'copy-mode -e -t ='", wheel_up)
        self.assertNotIn("copy-mode -e -t = \\", wheel_up)
        self.assertIn(["tmux", "bind-key", "-T", "root", "C-u", "copy-mode", "-e", "\\;", "send-keys", "-X", "-N", EXPECTED_SCROLL_LINES, "scroll-up"], calls)
        self.assertIn(["tmux", "bind-key", "-T", "root", "C-d", "copy-mode", "-e", "\\;", "send-keys", "-X", "-N", EXPECTED_SCROLL_LINES, "scroll-down"], calls)

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
            global_history_index = calls.index(
                ["tmux", "set-option", "-gq", "history-limit", EXPECTED_HISTORY_LIMIT]
            )
            self.assertLess(global_history_index, calls.index(new_session_call))
            send_keys_index = next(i for i, call in enumerate(calls) if call[:4] == ["tmux", "send-keys", "-t", "cdx_abc123"])
            self.assertLess(history_index, send_keys_index)
            self.assertIn("__runner abc123", calls[send_keys_index][-2])

    def test_codex_runner_uses_no_alt_screen_for_scrollback(self) -> None:
        self.assertEqual(cdx.codex_args_for_session({}), ["codex", "--no-alt-screen"])
        self.assertEqual(
            cdx.codex_args_for_session({"codex_session_id": "codex-1"}),
            ["codex", "resume", "--no-alt-screen", "codex-1"],
        )
        self.assertEqual(
            cdx.codex_args_for_session({"fork_from_codex_session_id": "codex-source"}),
            ["codex", "fork", "--no-alt-screen", "codex-source"],
        )

    def test_terminal_output_filter_removes_scrollback_clear_sequence(self) -> None:
        output_filter = cdx.TerminalOutputFilter()

        first = output_filter.feed(b"before\x1b[")
        second = output_filter.feed(b"3Jafter")
        final = output_filter.flush()

        self.assertEqual(first + second + final, b"beforeafter")

    def test_terminal_output_filter_keeps_regular_clear_screen_sequence(self) -> None:
        output_filter = cdx.TerminalOutputFilter()

        self.assertEqual(output_filter.feed(b"before\x1b[2Jafter") + output_filter.flush(), b"before\x1b[2Jafter")

    def test_mobile_context_view_enters_copy_mode_without_sending_to_codex_pane(self) -> None:
        calls: list[list[str]] = []
        old_is_mobile = cdx.is_mobile_like_terminal
        old_run = cdx.subprocess.run
        cdx.is_mobile_like_terminal = lambda: True
        cdx.subprocess.run = lambda args, **_kwargs: calls.append(list(args)) or Completed()
        try:
            cdx.prepare_mobile_context_view({"id": "abc123", "tmux_session": "cdx_demo", "transcript_path": "/tmp/demo.jsonl"})
        finally:
            cdx.is_mobile_like_terminal = old_is_mobile
            cdx.subprocess.run = old_run

        self.assertIn(["tmux", "copy-mode", "-e", "-t", "cdx_demo"], calls)
        self.assertTrue(any(call[:4] == ["tmux", "display-message", "-t", "cdx_demo"] for call in calls))
        self.assertFalse(any(call[:4] == ["tmux", "send-keys", "-t", "cdx_demo"] for call in calls))

    def test_desktop_context_view_does_not_enter_copy_mode(self) -> None:
        calls: list[list[str]] = []
        old_is_mobile = cdx.is_mobile_like_terminal
        old_run = cdx.subprocess.run
        cdx.is_mobile_like_terminal = lambda: False
        cdx.subprocess.run = lambda args, **_kwargs: calls.append(list(args)) or Completed()
        try:
            cdx.prepare_mobile_context_view({"tmux_session": "cdx_demo", "transcript_path": "/tmp/demo.jsonl"})
        finally:
            cdx.is_mobile_like_terminal = old_is_mobile
            cdx.subprocess.run = old_run

        self.assertEqual(calls, [])

    def test_codex_session_id_from_process_output_detects_resume_target(self) -> None:
        output = "\n".join(
            [
                "python3 /root/codex-deck/cdx __runner abc123",
                "node /usr/local/bin/codex resume --no-alt-screen 019e3f90-209d-71f0-ad82-9739a8b6f9be",
                "/vendor/codex/codex resume --no-alt-screen 019e3f90-209d-71f0-ad82-9739a8b6f9be",
            ]
        )

        self.assertEqual(
            cdx.codex_session_id_from_process_output(output),
            "019e3f90-209d-71f0-ad82-9739a8b6f9be",
        )

    def test_enter_session_recreates_stale_live_tmux_before_attach(self) -> None:
        session = {
            "id": "abc123",
            "name": "demo",
            "tmux_session": "cdx_abc123",
            "codex_session_id": "019e3f90-209d-71f0-ad82-9739a8b6f9be",
            "last_cwd": "/tmp",
        }
        events: list[str] = []

        old_tmux_exists = cdx.tmux_exists
        old_live_codex = getattr(cdx, "live_tmux_codex_session_id", None)
        old_codex_running = getattr(cdx, "codex_session_is_running", None)
        old_session_activity = cdx.session_activity
        old_recreate = getattr(cdx, "recreate_tmux_session", None)
        old_touch = cdx.touch_last_used
        old_attach = cdx.attach_tmux

        cdx.tmux_exists = lambda _name: True
        cdx.live_tmux_codex_session_id = lambda _name: "019e2445-1648-7fc2-af86-2b3c3f583680"
        cdx.codex_session_is_running = lambda _codex_id: False
        cdx.session_activity = lambda _session: {"state": "read", "started_at": None, "elapsed_seconds": None}
        cdx.recreate_tmux_session = lambda _session: events.append("recreate") or True
        cdx.touch_last_used = lambda _session_id, *, mark_viewed=False: events.append(f"touch:{mark_viewed}")
        cdx.attach_tmux = lambda _session: events.append("attach") or 0
        try:
            with redirect_stdout(io.StringIO()):
                rc = cdx.enter_session(session)
        finally:
            cdx.tmux_exists = old_tmux_exists
            if old_live_codex is None:
                delattr(cdx, "live_tmux_codex_session_id")
            else:
                cdx.live_tmux_codex_session_id = old_live_codex
            if old_codex_running is None:
                delattr(cdx, "codex_session_is_running")
            else:
                cdx.codex_session_is_running = old_codex_running
            cdx.session_activity = old_session_activity
            if old_recreate is None:
                delattr(cdx, "recreate_tmux_session")
            else:
                cdx.recreate_tmux_session = old_recreate
            cdx.touch_last_used = old_touch
            cdx.attach_tmux = old_attach

        self.assertEqual(rc, 0)
        self.assertEqual(events, ["recreate", "touch:True", "attach"])

    def test_enter_session_keeps_live_tmux_without_context_preview(self) -> None:
        session = {
            "id": "abc123",
            "name": "demo",
            "tmux_session": "cdx_abc123",
            "codex_session_id": "019e3f90-209d-71f0-ad82-9739a8b6f9be",
            "last_cwd": "/tmp",
        }
        events: list[str] = []

        old_tmux_exists = cdx.tmux_exists
        old_live_codex = getattr(cdx, "live_tmux_codex_session_id", None)
        old_has_preview = getattr(cdx, "tmux_has_latest_context_preview", None)
        old_session_activity = cdx.session_activity
        old_recreate = getattr(cdx, "recreate_tmux_session", None)
        old_touch = cdx.touch_last_used
        old_attach = cdx.attach_tmux

        cdx.tmux_exists = lambda _name: True
        cdx.live_tmux_codex_session_id = lambda _name: "019e3f90-209d-71f0-ad82-9739a8b6f9be"
        cdx.tmux_has_latest_context_preview = lambda _session: False
        cdx.session_activity = lambda _session: {"state": "read", "started_at": None, "elapsed_seconds": None}
        cdx.recreate_tmux_session = lambda _session: events.append("recreate") or True
        cdx.touch_last_used = lambda _session_id, *, mark_viewed=False: events.append(f"touch:{mark_viewed}")
        cdx.attach_tmux = lambda _session: events.append("attach") or 0
        try:
            with redirect_stdout(io.StringIO()):
                rc = cdx.enter_session(session)
        finally:
            cdx.tmux_exists = old_tmux_exists
            if old_live_codex is None:
                delattr(cdx, "live_tmux_codex_session_id")
            else:
                cdx.live_tmux_codex_session_id = old_live_codex
            if old_has_preview is None:
                delattr(cdx, "tmux_has_latest_context_preview")
            else:
                cdx.tmux_has_latest_context_preview = old_has_preview
            cdx.session_activity = old_session_activity
            if old_recreate is None:
                delattr(cdx, "recreate_tmux_session")
            else:
                cdx.recreate_tmux_session = old_recreate
            cdx.touch_last_used = old_touch
            cdx.attach_tmux = old_attach

        self.assertEqual(rc, 0)
        self.assertEqual(events, ["touch:True", "attach"])

    def test_enter_session_keeps_live_tmux_with_latest_context_preview(self) -> None:
        session = {
            "id": "abc123",
            "name": "demo",
            "tmux_session": "cdx_abc123",
            "codex_session_id": "019e3f90-209d-71f0-ad82-9739a8b6f9be",
            "last_cwd": "/tmp",
        }
        events: list[str] = []

        old_tmux_exists = cdx.tmux_exists
        old_live_codex = getattr(cdx, "live_tmux_codex_session_id", None)
        old_has_preview = getattr(cdx, "tmux_has_latest_context_preview", None)
        old_session_activity = cdx.session_activity
        old_recreate = getattr(cdx, "recreate_tmux_session", None)
        old_touch = cdx.touch_last_used
        old_attach = cdx.attach_tmux

        cdx.tmux_exists = lambda _name: True
        cdx.live_tmux_codex_session_id = lambda _name: "019e3f90-209d-71f0-ad82-9739a8b6f9be"
        cdx.tmux_has_latest_context_preview = lambda _session: True
        cdx.session_activity = lambda _session: {"state": "read", "started_at": None, "elapsed_seconds": None}
        cdx.recreate_tmux_session = lambda _session: events.append("recreate") or True
        cdx.touch_last_used = lambda _session_id, *, mark_viewed=False: events.append(f"touch:{mark_viewed}")
        cdx.attach_tmux = lambda _session: events.append("attach") or 0
        try:
            with redirect_stdout(io.StringIO()):
                rc = cdx.enter_session(session)
        finally:
            cdx.tmux_exists = old_tmux_exists
            if old_live_codex is None:
                delattr(cdx, "live_tmux_codex_session_id")
            else:
                cdx.live_tmux_codex_session_id = old_live_codex
            if old_has_preview is None:
                delattr(cdx, "tmux_has_latest_context_preview")
            else:
                cdx.tmux_has_latest_context_preview = old_has_preview
            cdx.session_activity = old_session_activity
            if old_recreate is None:
                delattr(cdx, "recreate_tmux_session")
            else:
                cdx.recreate_tmux_session = old_recreate
            cdx.touch_last_used = old_touch
            cdx.attach_tmux = old_attach

        self.assertEqual(rc, 0)
        self.assertEqual(events, ["touch:True", "attach"])

    def test_tmux_has_latest_context_preview_tolerates_wrapped_marker(self) -> None:
        session = {
            "id": "abc123",
            "name": "demo",
            "tmux_session": "cdx_abc123",
            "codex_session_id": "codex-1",
            "transcript_path": "/tmp/demo.jsonl",
        }
        marker = "[cdx-context-preview id=abc123 codex=codex-1 visible=2:abcdef1234567890]"
        wrapped_marker = "[cdx-context-preview id=abc123 codex=codex-\n1 visible=2:abcdef123\n4567890]"

        old_marker = cdx.session_context_preview_marker
        old_capture = cdx.tmux_capture_text
        cdx.session_context_preview_marker = lambda _session: marker
        cdx.tmux_capture_text = lambda _tmux_name, *, start="-": wrapped_marker
        try:
            self.assertTrue(cdx.tmux_has_latest_context_preview(session))
        finally:
            cdx.session_context_preview_marker = old_marker
            cdx.tmux_capture_text = old_capture

    def test_enter_session_keeps_live_tmux_when_current_task_is_running(self) -> None:
        session = {
            "id": "abc123",
            "name": "demo",
            "tmux_session": "cdx_abc123",
            "codex_session_id": "019e3f90-209d-71f0-ad82-9739a8b6f9be",
            "last_cwd": "/tmp",
        }
        events: list[str] = []

        old_tmux_exists = cdx.tmux_exists
        old_live_codex = getattr(cdx, "live_tmux_codex_session_id", None)
        old_session_activity = cdx.session_activity
        old_recreate = getattr(cdx, "recreate_tmux_session", None)
        old_touch = cdx.touch_last_used
        old_attach = cdx.attach_tmux

        cdx.tmux_exists = lambda _name: True
        cdx.live_tmux_codex_session_id = lambda _name: "019e2445-1648-7fc2-af86-2b3c3f583680"
        cdx.session_activity = lambda _session: {"state": "running", "started_at": "2026-05-12T00:00:00Z", "elapsed_seconds": 5}
        cdx.recreate_tmux_session = lambda _session: events.append("recreate") or True
        cdx.touch_last_used = lambda _session_id, *, mark_viewed=False: events.append(f"touch:{mark_viewed}")
        cdx.attach_tmux = lambda _session: events.append("attach") or 0
        try:
            with redirect_stdout(io.StringIO()):
                rc = cdx.enter_session(session)
        finally:
            cdx.tmux_exists = old_tmux_exists
            if old_live_codex is None:
                delattr(cdx, "live_tmux_codex_session_id")
            else:
                cdx.live_tmux_codex_session_id = old_live_codex
            cdx.session_activity = old_session_activity
            if old_recreate is None:
                delattr(cdx, "recreate_tmux_session")
            else:
                cdx.recreate_tmux_session = old_recreate
            cdx.touch_last_used = old_touch
            cdx.attach_tmux = old_attach

        self.assertEqual(rc, 0)
        self.assertEqual(events, ["touch:True", "attach"])


if __name__ == "__main__":
    unittest.main()
