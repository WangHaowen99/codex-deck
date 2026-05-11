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


def write_events(path: Path, events: list[dict]) -> None:
    path.write_text("\n".join(json.dumps(event) for event in events) + "\n", encoding="utf-8")


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

    def test_transcript_metrics_count_visible_turns_and_latest_token_count(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            transcript = Path(tmp) / "session.jsonl"
            write_events(
                transcript,
                [
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "message",
                            "role": "user",
                            "content": [{"type": "input_text", "text": "# AGENTS.md instructions for /repo\n\n<INSTRUCTIONS>internal</INSTRUCTIONS>"}],
                        },
                    },
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "message",
                            "role": "user",
                            "content": [{"type": "input_text", "text": "<environment_context>\n  <cwd>/repo</cwd>\n</environment_context>"}],
                        },
                    },
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "message",
                            "role": "user",
                            "content": [{"type": "input_text", "text": "帮我实现侧边栏指标"}],
                        },
                    },
                    {
                        "type": "event_msg",
                        "payload": {
                            "type": "user_message",
                            "message": "帮我实现侧边栏指标",
                        },
                    },
                    {
                        "type": "event_msg",
                        "payload": {
                            "type": "user_message",
                            "message": "再加一个 tooltip",
                        },
                    },
                    {
                        "timestamp": "2026-05-11T08:00:00.000Z",
                        "type": "response_item",
                        "payload": {
                            "type": "message",
                            "role": "user",
                            "content": [{"type": "input_text", "text": "继续"}],
                        },
                    },
                    {
                        "timestamp": "2026-05-11T08:00:00.001Z",
                        "type": "event_msg",
                        "payload": {
                            "type": "user_message",
                            "message": "继续",
                        },
                    },
                    {
                        "timestamp": "2026-05-11T08:05:00.000Z",
                        "type": "response_item",
                        "payload": {
                            "type": "message",
                            "role": "user",
                            "content": [{"type": "input_text", "text": "继续"}],
                        },
                    },
                    {
                        "timestamp": "2026-05-11T08:05:00.001Z",
                        "type": "event_msg",
                        "payload": {
                            "type": "user_message",
                            "message": "继续",
                        },
                    },
                    {
                        "type": "event_msg",
                        "payload": {
                            "type": "token_count",
                            "info": {
                                "total_token_usage": {"total_tokens": 1000},
                                "last_token_usage": {"total_tokens": 100},
                                "model_context_window": 1000,
                            },
                        },
                    },
                    {
                        "type": "event_msg",
                        "payload": {
                            "type": "token_count",
                            "info": {
                                "total_token_usage": {"total_tokens": 1234567},
                                "last_token_usage": {"total_tokens": 129200},
                                "model_context_window": 258400,
                            },
                        },
                    },
                ],
            )

            metrics = cdx.transcript_metrics(str(transcript))

            self.assertEqual(metrics["turn_count"], 4)
            self.assertEqual(metrics["total_tokens"], 1234567)
            self.assertEqual(metrics["context_tokens"], 129200)
            self.assertEqual(metrics["context_window"], 258400)
            self.assertEqual(metrics["context_percent"], 50)

    def test_session_json_includes_transcript_metrics(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            transcript = Path(tmp) / "session.jsonl"
            write_events(
                transcript,
                [
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "message",
                            "role": "user",
                            "content": [{"type": "input_text", "text": "第一轮"}],
                        },
                    },
                    {
                        "type": "event_msg",
                        "payload": {
                            "type": "token_count",
                            "info": {
                                "total_token_usage": {"total_tokens": 4096},
                                "last_token_usage": {"input_tokens": 1024, "output_tokens": 256},
                                "model_context_window": 4096,
                            },
                        },
                    },
                ],
            )
            session = {
                "id": "abc",
                "name": "demo",
                "tmux_session": "cdx_abc",
                "codex_session_id": "codex-1",
                "transcript_path": str(transcript),
                "last_viewed_at": "2026-05-09T08:00:00Z",
            }
            old_tmux_exists = cdx.tmux_exists
            cdx.tmux_exists = lambda _: False
            try:
                data = cdx.session_json(session, include_status=False)
            finally:
                cdx.tmux_exists = old_tmux_exists

            self.assertEqual(data["turn_count"], 1)
            self.assertEqual(data["total_tokens"], 4096)
            self.assertEqual(data["context_tokens"], 1280)
            self.assertEqual(data["context_window"], 4096)
            self.assertEqual(data["context_percent"], 31)

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

    def test_activity_state_reports_running_elapsed_time(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            transcript = Path(tmp) / "session.jsonl"
            write_events(
                transcript,
                [
                    {"timestamp": "2026-05-09T08:00:00Z", "type": "event_msg", "payload": {"type": "task_started"}},
                    {"timestamp": "2026-05-09T08:01:00Z", "type": "response_item", "payload": {"type": "reasoning"}},
                ],
            )
            session = {
                "id": "abc",
                "name": "demo",
                "tmux_session": "cdx_abc",
                "codex_session_id": "codex-1",
                "transcript_path": str(transcript),
                "last_viewed_at": "2026-05-09T07:00:00Z",
            }
            old_tmux_exists = cdx.tmux_exists
            cdx.tmux_exists = lambda _: True
            try:
                state = cdx.session_activity(session, now=cdx.parse_iso("2026-05-09T08:03:30Z"))
            finally:
                cdx.tmux_exists = old_tmux_exists

            self.assertEqual(state["state"], "running")
            self.assertEqual(state["started_at"], "2026-05-09T08:00:00Z")
            self.assertEqual(state["elapsed_seconds"], 210)

    def test_activity_state_falls_back_to_unread_after_task_complete(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            transcript = Path(tmp) / "session.jsonl"
            write_events(
                transcript,
                [
                    {"timestamp": "2026-05-09T08:00:00Z", "type": "event_msg", "payload": {"type": "task_started"}},
                    {"timestamp": "2026-05-09T08:03:00Z", "type": "event_msg", "payload": {"type": "task_complete"}},
                ],
            )
            timestamp = cdx.parse_iso("2026-05-09T08:03:00Z").timestamp()
            os.utime(transcript, (timestamp, timestamp))
            session = {
                "id": "abc",
                "name": "demo",
                "tmux_session": "cdx_abc",
                "codex_session_id": "codex-1",
                "transcript_path": str(transcript),
                "last_viewed_at": "2026-05-09T07:00:00Z",
            }
            old_tmux_exists = cdx.tmux_exists
            cdx.tmux_exists = lambda _: True
            try:
                state = cdx.session_activity(session, now=cdx.parse_iso("2026-05-09T08:04:00Z"))
            finally:
                cdx.tmux_exists = old_tmux_exists

            self.assertEqual(state["state"], "unread")
            self.assertIsNone(state["elapsed_seconds"])

    def test_shell_snapshot_binds_unbound_session_without_hook(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            registry_path = tmp_path / "sessions.json"
            lock_path = tmp_path / "lock"
            codex_home = tmp_path / "codex"
            snapshots = codex_home / "shell_snapshots"
            snapshots.mkdir(parents=True)
            codex_id = "019e14d9-b98b-73a0-868c-2d2421a505f8"
            snapshot = snapshots / f"{codex_id}.1778466273676638499.sh"
            snapshot.write_text(
                "\n".join(
                    [
                        "# Snapshot file",
                        'declare -x CDX_NAME="demo"',
                        'declare -x CDX_REGISTRY="/tmp/other.json"',
                        'declare -x CDX_SESSION_ID="abc123"',
                    ]
                ),
                encoding="utf-8",
            )
            registry_path.write_text(
                json.dumps(
                    {
                        "version": cdx.VERSION,
                        "sessions": [
                            {
                                "id": "abc123",
                                "name": "demo",
                                "tmux_session": "cdx_abc123",
                                "codex_session_id": None,
                                "created_at": "2026-05-11T02:24:30Z",
                                "updated_at": "2026-05-11T02:24:30Z",
                                "last_used_at": "2026-05-11T02:24:30Z",
                                "last_viewed_at": "2026-05-11T02:24:30Z",
                                "transcript_path": None,
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            old_registry_path = cdx.REGISTRY_PATH
            old_lock_path = cdx.LOCK_PATH
            old_snapshots_dir = cdx.CODEX_SHELL_SNAPSHOTS_DIR
            cdx.REGISTRY_PATH = registry_path
            cdx.LOCK_PATH = lock_path
            cdx.CODEX_SHELL_SNAPSHOTS_DIR = snapshots
            try:
                self.assertTrue(cdx.bind_from_recent_shell_snapshots("abc123", started_at=0))
                refreshed = cdx.load_registry()["sessions"][0]
                self.assertEqual(refreshed["codex_session_id"], codex_id)
                self.assertIsNone(refreshed["transcript_path"])
            finally:
                cdx.REGISTRY_PATH = old_registry_path
                cdx.LOCK_PATH = old_lock_path
                cdx.CODEX_SHELL_SNAPSHOTS_DIR = old_snapshots_dir

    def test_session_json_resolves_missing_transcript_path_from_rollout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            sessions_dir = tmp_path / "sessions"
            rollout_dir = sessions_dir / "2026" / "05" / "11"
            rollout_dir.mkdir(parents=True)
            codex_id = "019e14d9-b98b-73a0-868c-2d2421a505f8"
            transcript = rollout_dir / f"rollout-2026-05-11T10-24-33-{codex_id}.jsonl"
            write_transcript(transcript, datetime(2026, 5, 11, 2, 30, tzinfo=timezone.utc))
            session = {
                "id": "abc123",
                "name": "demo",
                "tmux_session": "cdx_abc123",
                "codex_session_id": codex_id,
                "transcript_path": None,
                "last_viewed_at": "2026-05-11T02:24:30Z",
            }
            old_sessions_dir = cdx.CODEX_SESSIONS_DIR
            old_tmux_exists = cdx.tmux_exists
            cdx.CODEX_SESSIONS_DIR = sessions_dir
            cdx.tmux_exists = lambda _: False
            try:
                data = cdx.session_json(session, include_status=False)
            finally:
                cdx.CODEX_SESSIONS_DIR = old_sessions_dir
                cdx.tmux_exists = old_tmux_exists

            self.assertEqual(data["transcript_path"], str(transcript))
            self.assertEqual(data["conversation_updated_at"], "2026-05-11T02:30:00Z")
            self.assertTrue(data["unread"])


if __name__ == "__main__":
    unittest.main()
