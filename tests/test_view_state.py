import importlib.util
import os
import sys
import tempfile
import unittest
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


if __name__ == "__main__":
    unittest.main()
