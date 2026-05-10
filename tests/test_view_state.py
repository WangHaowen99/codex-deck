import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from importlib.machinery import SourceFileLoader
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_loader("cdx_module", SourceFileLoader("cdx_module", str(ROOT / "cdx")))
cdx = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = cdx
SPEC.loader.exec_module(cdx)


def write_transcript(path: Path, mtime: datetime) -> None:
    path.write_text('{"type":"event_msg","payload":{"type":"agent_message","message":"done"}}\n', encoding="utf-8")
    timestamp = mtime.timestamp()
    os.utime(path, (timestamp, timestamp))


class ViewStateTests(unittest.TestCase):
    def test_unbound_session_is_never_unread(self) -> None:
        session = {
            "id": "abc",
            "name": "demo",
            "tmux_session": "cdx_abc",
            "codex_session_id": None,
        }

        self.assertFalse(cdx.session_has_unread_result(session))

    def test_transcript_newer_than_last_viewed_is_unread(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            transcript = Path(tmp) / "session.jsonl"
            write_transcript(transcript, datetime(2026, 5, 9, 8, 30, tzinfo=timezone.utc))
            session = {
                "id": "abc",
                "name": "demo",
                "tmux_session": "cdx_abc",
                "codex_session_id": "codex-1",
                "transcript_path": str(transcript),
                "last_viewed_at": "2026-05-09T08:00:00Z",
            }

            self.assertTrue(cdx.session_has_unread_result(session))

    def test_session_json_includes_view_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            transcript = Path(tmp) / "session.jsonl"
            write_transcript(transcript, datetime(2026, 5, 9, 8, 30, tzinfo=timezone.utc))
            session = {
                "id": "abc",
                "name": "demo",
                "tmux_session": "cdx_abc",
                "codex_session_id": "codex-1",
                "transcript_path": str(transcript),
                "last_viewed_at": "2026-05-09T08:00:00Z",
            }

            data = cdx.session_json(session, include_status=False)

            self.assertTrue(data["unread"])
            self.assertEqual(data["last_viewed_at"], "2026-05-09T08:00:00Z")
            self.assertIsNotNone(data["conversation_updated_at"])

    def test_mark_viewed_command_clears_unread_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            transcript = tmp_path / "session.jsonl"
            write_transcript(transcript, datetime(2026, 5, 9, 8, 30, tzinfo=timezone.utc))
            registry_path = tmp_path / "sessions.json"
            lock_path = tmp_path / "lock"
            registry_path.write_text(
                json.dumps(
                    {
                        "version": cdx.VERSION,
                        "sessions": [
                            {
                                "id": "abc",
                                "name": "demo",
                                "tmux_session": "cdx_abc",
                                "codex_session_id": "codex-1",
                                "transcript_path": str(transcript),
                                "created_at": "2026-05-09T07:00:00Z",
                                "updated_at": "2026-05-09T08:00:00Z",
                                "last_used_at": "2026-05-09T08:00:00Z",
                                "last_viewed_at": "2026-05-09T08:00:00Z",
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            old_registry_path = cdx.REGISTRY_PATH
            old_lock_path = cdx.LOCK_PATH
            cdx.REGISTRY_PATH = registry_path
            cdx.LOCK_PATH = lock_path
            try:
                self.assertTrue(cdx.session_has_unread_result(cdx.load_registry()["sessions"][0]))
                output = io.StringIO()
                with redirect_stdout(output):
                    rc = cdx.cmd_mark_viewed(["--json", "demo"])
                self.assertEqual(rc, 0)
                payload = json.loads(output.getvalue())
                self.assertTrue(payload["ok"])
                refreshed = cdx.load_registry()["sessions"][0]
                self.assertFalse(cdx.session_has_unread_result(refreshed))
                self.assertGreaterEqual(
                    cdx.sort_key_time(refreshed["last_viewed_at"]),
                    cdx.sort_key_time(cdx.session_conversation_updated_at(refreshed)),
                )
            finally:
                cdx.REGISTRY_PATH = old_registry_path
                cdx.LOCK_PATH = old_lock_path


if __name__ == "__main__":
    unittest.main()
