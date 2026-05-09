# Codex Deck VS Code Extension

This extension adds a Codex Deck sidebar for VS Code and VS Code Remote SSH.

It does not reimplement Codex Deck. It calls the remote/workspace `cdx` command:

- `cdx list --json`
- `cdx new --cwd <path> --no-enter --json <cdx_name>`
- `cdx rename --json <old> <new>`
- `cdx delete --yes --json <cdx_name>`
- `cdx enter <cdx_name>`
- `cdx enter --new-if-unbound <cdx_name>`

Unread Codex results are shown in the session description. When `cdx list --json`
reports `unread: true`, the tree item uses a red dot icon.

## Development

```bash
cd vscode-extension
npm install
npm run compile
```

Open this folder in VS Code and press `F5` to launch an extension development host.

For Remote SSH, install/run the extension on the remote workspace side so `cdx` resolves to the remote Codex Deck executable.
