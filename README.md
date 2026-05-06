# Codex Deck

Codex Deck is a small `cdx` command for managing Codex CLI sessions as named, reconnectable workspaces. It is built for people who use Codex over SSH, especially from a phone, where losing a terminal or hunting through `codex resume --all` is painful.

## Why It Exists

Codex already has session history, and tmux already keeps terminals alive. Codex Deck connects those two pieces into one workflow:

- You name a work purpose once, such as `论文写作`, `股票研究`, or `项目重构`.
- `cdx` creates or reuses a dedicated tmux session for that purpose.
- Codex Deck records the mapping from your `cdx_name` to the underlying Codex session id.
- Next time, `cdx enter <name>` reconnects to the live tmux session if it is running, or starts a fresh tmux session and runs `codex resume <session_id>`.

The result is a stable deck of Codex workspaces instead of a long, hard-to-read list of raw Codex conversations.

## What Makes It Useful

- **Phone SSH friendly**: all primary flows are menu and number driven.
- **Reconnectable by default**: every Codex session runs inside tmux, so SSH drops do not destroy your live terminal.
- **Purpose-first naming**: you manage sessions by human names, not UUIDs.
- **Reliable Codex mapping**: a Codex `SessionStart` hook records the real Codex session id when Codex starts or resumes.
- **No accidental history deletion**: deleting a `cdx` session removes only the Codex Deck mapping and kills the tmux session; it does not delete Codex's original history.
- **Global session registry**: `cdx_name` is globally unique and represents a usage purpose, not a git branch or current directory.
- **Safe tmux naming**: tmux session names are generated as `cdx_<internal_id>`, so user-facing names can contain Chinese, spaces, or punctuation.
- **Manual repair tools**: bind, import, unbind, or transfer mappings between `cdx` sessions and raw Codex sessions.
- **Doctor mode**: `cdx doctor` reports config, hook, tmux, root, directory, and mapping problems without mutating state.
- **XDG layout**: config, registry, lock files, and logs are kept in standard user-level locations.

## Core Workflow

```bash
cdx                 # open the menu
cdx new 写论文       # create a named Codex workspace
cdx enter 写论文     # reconnect or resume
cdx list            # list managed workspaces
cdx map             # manually manage raw Codex mappings
cdx roots           # manage common root directories
cdx doctor          # report state problems
```

When creating a new workspace, Codex Deck asks you to choose a common root directory. The default root is your home directory. You can optionally enter a relative folder name, such as `research/paper-a`; Codex Deck creates it if needed and stores it as that session's restore directory.

## Data Model

Codex Deck stores its own registry and does not treat Codex internals as its source of truth:

```text
cdx_name -> cdx internal id -> tmux session -> Codex session id
```

User data lives here:

```text
~/.config/cdx/config.json
~/.local/share/cdx/sessions.json
~/.local/state/cdx/cdx.log
~/.local/state/cdx/lock
```

Codex integration is installed here:

```text
~/.codex/config.toml   # enables features.codex_hooks
~/.codex/hooks.json    # installs the SessionStart hook
```

The hook is guarded by `CDX_SESSION_ID`; normal manual `codex` sessions are ignored.

## One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/WangHaowen99/codex-deck/develop/install.sh | bash
```

The installer downloads `cdx` to `~/.local/bin/cdx`, marks it executable, and runs `cdx init`.

If `~/.local/bin` is not in your `PATH`, add this to your shell profile:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Requirements

- Linux or a Unix-like shell environment
- Python 3
- tmux
- Codex CLI
- curl or wget for the one-line installer
- GitHub access only for installation from this repository

Check dependencies:

```bash
python3 --version
tmux -V
codex --version
```

## Manual Install

```bash
git clone https://github.com/WangHaowen99/codex-deck.git
cd codex-deck
git checkout develop
chmod +x cdx install.sh
./install.sh
```

To install somewhere else:

```bash
INSTALL_DIR=/usr/local/bin ./install.sh
```

To install without running `cdx init`:

```bash
CDX_SKIP_INIT=1 ./install.sh
```

Then run initialization later:

```bash
cdx init
```

## Initialization Details

`cdx init` does three things:

1. Creates the XDG config, registry, state, and log directories.
2. Adds a default common root named `home`.
3. Enables Codex hooks and installs a `SessionStart` hook.

Before changing `~/.codex/config.toml`, Codex Deck creates a timestamped backup:

```text
~/.codex/config.toml.cdx.bak.<timestamp>
```

## Uninstall

Remove the installed command:

```bash
rm -f ~/.local/bin/cdx
```

Then remove Codex Deck data if you no longer need it:

```bash
rm -rf ~/.config/cdx ~/.local/share/cdx ~/.local/state/cdx
```

Codex Deck does not delete Codex's original conversation history.

