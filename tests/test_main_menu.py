import importlib.util
import io
import sys
import unittest
from contextlib import redirect_stdout
from importlib.machinery import SourceFileLoader
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_loader("cdx_module_main_menu", SourceFileLoader("cdx_module_main_menu", str(ROOT / "cdx")))
cdx = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = cdx
SPEC.loader.exec_module(cdx)


class MainMenuTests(unittest.TestCase):
    def test_main_menu_hides_advanced_entries(self) -> None:
        calls: list[str] = []
        choices = iter(["6", "7", "8", "0"])
        old_load_registry = cdx.load_registry
        old_tmux_exists = cdx.tmux_exists
        old_prompt = cdx.prompt
        old_cmd_roots = cdx.cmd_roots
        old_cmd_doctor = cdx.cmd_doctor
        old_cmd_uuid = cdx.cmd_uuid
        cdx.load_registry = lambda: {"version": cdx.VERSION, "sessions": []}
        cdx.tmux_exists = lambda _name: False
        cdx.prompt = lambda _message: next(choices)
        cdx.cmd_roots = lambda _args: calls.append("roots") or 0
        cdx.cmd_doctor = lambda _args: calls.append("doctor") or 0
        cdx.cmd_uuid = lambda _args: calls.append("uuid") or 0
        try:
            output = io.StringIO()
            with redirect_stdout(output):
                rc = cdx.main_menu()
        finally:
            cdx.load_registry = old_load_registry
            cdx.tmux_exists = old_tmux_exists
            cdx.prompt = old_prompt
            cdx.cmd_roots = old_cmd_roots
            cdx.cmd_doctor = old_cmd_doctor
            cdx.cmd_uuid = old_cmd_uuid

        text = output.getvalue()
        self.assertEqual(rc, 0)
        self.assertNotIn("管理常用目录", text)
        self.assertNotIn("检查状态 doctor", text)
        self.assertNotIn("查看 UUID", text)
        self.assertEqual(calls, [])

    def test_main_menu_exposes_close_and_history_actions(self) -> None:
        calls: list[str] = []
        choices = iter(["c", "h", "0"])
        old_load_registry = cdx.load_registry
        old_tmux_exists = cdx.tmux_exists
        old_prompt = cdx.prompt
        old_cmd_close = cdx.cmd_close
        old_cmd_history = cdx.cmd_history
        cdx.load_registry = lambda: {"version": cdx.VERSION, "sessions": []}
        cdx.tmux_exists = lambda _name: False
        cdx.prompt = lambda _message: next(choices)
        cdx.cmd_close = lambda _args: calls.append("close") or 0
        cdx.cmd_history = lambda _args: calls.append("history") or 0
        try:
            output = io.StringIO()
            with redirect_stdout(output):
                rc = cdx.main_menu()
        finally:
            cdx.load_registry = old_load_registry
            cdx.tmux_exists = old_tmux_exists
            cdx.prompt = old_prompt
            cdx.cmd_close = old_cmd_close
            cdx.cmd_history = old_cmd_history

        text = output.getvalue()
        self.assertEqual(rc, 0)
        self.assertIn("关闭会话", text)
        self.assertIn("历史会话", text)
        self.assertEqual(calls, ["close", "history"])


if __name__ == "__main__":
    unittest.main()
