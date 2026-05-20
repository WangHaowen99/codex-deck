# Codex Deck VS Code Extension

This extension adds a Codex Deck sidebar for VS Code and VS Code Remote SSH.

It does not reimplement Codex Deck. It calls the remote/workspace `cdx` command:

- `cdx list --json`
- `cdx new --cwd <path> --no-enter --json <cdx_name>`
- `cdx fork --no-enter --json <source_cdx_name> <new_cdx_name>`
- `cdx rename --json <old> <new>`
- `cdx delete --yes --json <cdx_name>`
- `cdx enter <cdx_name>`
- `cdx enter --new-if-unbound <cdx_name>`

Unread Codex results are shown in the session description. When `cdx list --json`
reports `unread: true`, the tree item uses a red dot icon.

Opening the same cdx session again reuses the existing VS Code terminal. Closing
that terminal clears the cache, so the next open creates a fresh terminal.

Opening a session also calls `cdx mark-viewed --json <cdx_name>` so unread
indicators clear even when an existing terminal is reused.

While Codex is generating, the sidebar shows an orange dot and elapsed time.
Completed sessions use a red dot for unread results and a green dot for read
results.

The sidebar also displays per-session metrics from `cdx list --json`: total
tokens, user turn count, current context usage percentage, compaction count,
tool call count, cache hit rate, and failure count.
If the remote `cdx` command does not report those fields yet, the extension
falls back to parsing the session transcript path returned by `cdx list --json`.
Hovering a session shows additional agent action details such as tool breakdown,
edited file count, command success rate, command time, latest turn time, and
first-token latency.

For details that need more reading time, right-click a session and open the
persistent Markdown views for failure reasons, tool call details, or compaction
details.

## Development

```bash
cd vscode-extension
npm install
npm run compile
```

Open this folder in VS Code and press `F5` to launch an extension development host.

For Remote SSH, install/run the extension on the remote workspace side so `cdx` resolves to the remote Codex Deck executable.
