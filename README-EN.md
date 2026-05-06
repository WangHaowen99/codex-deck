<div align="center" id="codex-deck">

<img src="_image/app_icon.png" alt="Codex Deck App Icon" width="140">

# Codex Deck

A Codex CLI session manager for phone SSH and remote terminals.  
Use one `cdx` command to turn raw Codex conversations and tmux terminals into named, reconnectable workspaces.

[![GitHub Stars](https://img.shields.io/github/stars/WangHaowen99/codex-deck?style=flat-square&logo=github&color=yellow)](https://github.com/WangHaowen99/codex-deck/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/WangHaowen99/codex-deck?style=flat-square&logo=github&color=blue)](https://github.com/WangHaowen99/codex-deck/network/members)
[![Branch](https://img.shields.io/badge/default_branch-develop-2ea44f?style=flat-square&logo=git)](https://github.com/WangHaowen99/codex-deck/tree/develop)
[![Python](https://img.shields.io/badge/Python-3.x-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![tmux](https://img.shields.io/badge/tmux-required-1BB91F?style=flat-square)](https://github.com/tmux/tmux)
[![Codex CLI](https://img.shields.io/badge/Codex_CLI-supported-111111?style=flat-square)](https://developers.openai.com/codex)

**[中文](README.md)** | **English**

</div>

> Codex Deck is lightweight, stable, and easy to deploy. It is designed for long-running Codex usage over phone SSH or remote terminals.

<br>

## Contents

|   |   |   |
|:---:|:---:|:---:|
| [Quick Start](#quick-start) | [Advantages](#advantages) | [Workflow](#workflow) |
| [Features](#features) | [Data and Safety](#data-and-safety) | [Install](#install) |
| [Commands](#commands) | [Doctor](#doctor) | [Uninstall](#uninstall) |

<br>

## Quick Start

One-line install:

```bash
curl -fsSL https://raw.githubusercontent.com/WangHaowen99/codex-deck/develop/install.sh | bash
```

Open the menu:

```bash
cdx
```

Create a workspace:

```bash
cdx new paper-writing
```

Resume later:

```bash
cdx enter paper-writing
```

<br>

## Advantages

### Phone SSH Friendly

Primary flows use menus and numeric choices. You do not need to inspect long Codex UUIDs on a narrow terminal.

### Reconnectable by Default

Each Codex workspace runs in its own tmux session. If SSH drops, Codex keeps running remotely. Reconnect with `cdx enter <name>`.

### Purpose-First Naming

Manage work by names such as:

```text
paper-writing
stock-research
project-refactor
long-term-assistant
```

### Codex History Is Preserved

`cdx delete` removes only the Codex Deck mapping and kills the related tmux session. It does not delete the original Codex history.

### Reliable Mapping and Manual Repair

Codex Deck uses a Codex `SessionStart` hook to capture the real Codex session id. It also supports binding, importing, unbinding, and transferring raw Codex sessions.

### Single-File Tool

The main tool is one Python script. It only needs Python 3, tmux, and Codex CLI.

<br>

## Workflow

Codex Deck joins these layers:

```text
cdx_name -> cdx internal id -> tmux session -> Codex session id
```

Entering a workspace:

```text
cdx enter paper-writing
  ├─ attach/switch to the live tmux session if it exists
  └─ otherwise create tmux and run codex resume <session_id>
```

Creating a workspace:

```text
enter cdx_name
choose a common root directory
optionally enter a relative folder
create the cdx registry record
start tmux + Codex
Codex hook writes back the real session id
```

<br>

## Features

| Feature | Description |
|:---|:---|
| Session list | Shows only cdx-managed sessions, sorted by recent use |
| New session | Choose a root directory and optionally create a subdirectory |
| Enter session | Attach to live tmux or resume Codex automatically |
| Mouse scrolling | cdx refreshes tmux mouse mode and intercepts wheel events so Codex does not treat them as arrow keys |
| UUID lookup | Show the Codex session id bound to a cdx workspace |
| Delete session | Kill tmux and remove cdx mapping, preserving Codex history |
| Rename | Supports live sessions |
| Roots | Manage common root directories |
| Mapping | Bind, import, unbind, or transfer raw Codex sessions |
| Doctor | Report config, hook, registry, tmux, cwd, and mapping issues |

<br>

## Data and Safety

Codex Deck uses XDG-style paths:

```text
~/.config/cdx/config.json
~/.local/share/cdx/sessions.json
~/.local/state/cdx/cdx.log
~/.local/state/cdx/lock
```

Codex integration:

```text
~/.codex/config.toml
~/.codex/hooks.json
```

Safety choices:

- Registry writes use `flock`
- Writes are atomic
- Deleting a cdx session does not delete Codex history
- The hook only runs when `CDX_SESSION_ID` is present
- Logs do not store Codex conversation content
- `~/.codex/config.toml` is backed up before modification

<br>

## Install

One-line install:

```bash
curl -fsSL https://raw.githubusercontent.com/WangHaowen99/codex-deck/develop/install.sh | bash
```

Default target:

```text
~/.local/bin/cdx
```

If needed:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Requirements:

```bash
python3 --version
tmux -V
codex --version
```

Manual install:

```bash
git clone https://github.com/WangHaowen99/codex-deck.git
cd codex-deck
git checkout develop
chmod +x cdx install.sh
./install.sh
```

Custom install directory:

```bash
INSTALL_DIR=/usr/local/bin ./install.sh
```

Skip initialization:

```bash
CDX_SKIP_INIT=1 ./install.sh
cdx init
```

<br>

## Commands

```bash
cdx                       # open menu
cdx list                  # list cdx sessions
cdx new [cdx_name]        # create session; same name enters existing
cdx enter [cdx_name]      # enter session
cdx uuid [cdx_name]       # show the bound Codex session id
cdx uuid --all            # list UUID mappings for all cdx sessions
cdx delete [cdx_name]     # remove cdx mapping and kill tmux
cdx rename [OLD NEW]      # rename session
cdx roots                 # manage common roots
cdx map                   # manage raw Codex mappings
cdx doctor                # report state problems
cdx init                  # initialize and install hook
cdx install-hook          # refresh Codex hook
```

<br>

## Doctor

```bash
cdx doctor
```

Doctor reports problems but does not mutate state.

<br>

## Uninstall

```bash
rm -f ~/.local/bin/cdx
rm -rf ~/.config/cdx ~/.local/share/cdx ~/.local/state/cdx
```

Codex Deck does not delete original Codex conversation history.
