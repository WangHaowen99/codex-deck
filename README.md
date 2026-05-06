<div align="center" id="codex-deck">

# Codex Deck

专为手机 SSH 和远程终端打造的 Codex 会话管理器  
用一个 `cdx` 命令，把 Codex 历史会话和 tmux 运行现场整理成稳定、可恢复、可命名的工作台

[![GitHub Stars](https://img.shields.io/github/stars/WangHaowen99/codex-deck?style=flat-square&logo=github&color=yellow)](https://github.com/WangHaowen99/codex-deck/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/WangHaowen99/codex-deck?style=flat-square&logo=github&color=blue)](https://github.com/WangHaowen99/codex-deck/network/members)
[![Branch](https://img.shields.io/badge/default_branch-develop-2ea44f?style=flat-square&logo=git)](https://github.com/WangHaowen99/codex-deck/tree/develop)
[![Python](https://img.shields.io/badge/Python-3.x-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![tmux](https://img.shields.io/badge/tmux-required-1BB91F?style=flat-square)](https://github.com/tmux/tmux)
[![Codex CLI](https://img.shields.io/badge/Codex_CLI-supported-111111?style=flat-square)](https://developers.openai.com/codex)

**中文** | **[English](README-EN.md)**

</div>

> 本项目以轻量、稳定、易部署为目标。核心场景是：通过手机或远程 SSH 长时间使用 Codex，不再被断线、原始 UUID、`codex resume --all` 难辨认等问题打断。

<br>

## 📑 快速导航

<div align="center">

|   |   |   |
|:---:|:---:|:---:|
| [🚀 快速开始](#-快速开始) | [🎯 核心优势](#-核心优势) | [🧭 工作流](#-工作流) |
| [🧩 核心功能](#-核心功能) | [📁 数据与安全](#-数据与安全) | [⚙️ 安装部署](#️-安装部署) |
| [🛠️ 常用命令](#️-常用命令) | [🧪 状态检查](#-状态检查) | [🧹 卸载](#-卸载) |

</div>

<br>

## 🚀 快速开始

一行安装：

```bash
curl -fsSL https://raw.githubusercontent.com/WangHaowen99/codex-deck/develop/install.sh | bash
```

安装后直接运行：

```bash
cdx
```

新建并进入一个 Codex 工作台：

```bash
cdx new 写论文
```

之后随时恢复：

```bash
cdx enter 写论文
```

<br>

## 🎯 核心优势

### 1. 为手机 SSH 设计

`cdx` 的主流程是菜单和编号选择，不依赖复杂快捷键，也不要求你在窄屏里辨认一长串 Codex UUID。断线后重新 SSH 回来，再执行 `cdx enter <name>` 即可回到对应工作台。

### 2. tmux 保留运行现场

每个 Codex 会话都运行在独立 tmux session 里：

- SSH 断开，Codex 仍在远端运行
- 任务执行中断线，可以重新 attach
- 当前 tmux 存在时优先回到现场
- tmux 不存在时自动 `codex resume <session_id>`

### 3. 用用途名管理，而不是用 UUID 管理

你只需要记住：

```text
写论文
股票研究
项目重构
长期助理
```

不用再从 `codex resume --all` 里猜哪一个是当前要找的会话。

### 4. Codex 原始历史不被破坏

`cdx delete` 只删除 Codex Deck 自己的映射，并关闭对应 tmux；不会物理删除 Codex 原始历史。即使误删 `cdx` 映射，仍然可以通过手动导入或绑定找回原始 Codex 会话。

### 5. 映射可靠，支持手动修复

Codex Deck 使用 Codex `SessionStart` hook 获取真实 Codex session id，并写入自己的注册表。它还提供：

- 绑定已有 Codex 会话
- 导入 Codex 原始会话
- 解除绑定
- 转移绑定
- `doctor` 状态检查

### 6. 单文件、少依赖、易部署

主体是一个 Python 单文件脚本，只依赖：

- Python 3
- tmux
- Codex CLI

安装脚本只是把 `cdx` 放到本地 bin 目录，然后执行初始化。

<br>

## 🧭 工作流

Codex Deck 把三层状态统一起来：

```text
cdx_name -> cdx 内部 id -> tmux session -> Codex session id
```

实际行为：

```text
cdx enter 写论文
  ├─ 如果 cdx_内部id 的 tmux 还活着：直接 attach/switch
  └─ 如果 tmux 不存在：新建 tmux，并运行 codex resume <session_id>
```

新建会话时：

```text
输入 cdx_name
选择常用目录
可选输入相对文件夹名
创建 cdx 注册表记录
启动 tmux + Codex
Codex hook 回写真实 session id
```

<br>

## 🧩 核心功能

| 功能 | 说明 |
|:---|:---|
| 会话列表 | 只展示 cdx 管理的会话，按最近使用时间排序 |
| 新建会话 | 输入全局唯一用途名，选择常用目录，可选创建子目录 |
| 进入会话 | 优先 attach 到 live tmux，否则自动 resume Codex |
| 删除会话 | kill 对应 tmux，删除 cdx 映射，不删除 Codex 原始历史 |
| 重命名 | 支持中文和空格，live 会话也可重命名 |
| 常用目录 | 管理新建会话时可选的 root 目录 |
| 手动映射 | 绑定、导入、解除、转移 Codex 原始会话 |
| 状态检查 | 检查配置、hook、注册表、tmux、cwd、重复映射 |

<br>

## 📁 数据与安全

Codex Deck 使用 XDG 风格路径：

```text
~/.config/cdx/config.json
~/.local/share/cdx/sessions.json
~/.local/state/cdx/cdx.log
~/.local/state/cdx/lock
```

Codex 集成写入：

```text
~/.codex/config.toml   # 启用 features.codex_hooks
~/.codex/hooks.json    # 安装 SessionStart hook
```

安全策略：

- 注册表写入使用 `flock` 加锁
- 写文件使用临时文件和原子替换
- 删除 cdx 会话不删除 Codex 原始历史
- hook 只有检测到 `CDX_SESSION_ID` 时才工作
- 工具日志不记录 Codex 对话内容
- 修改 `~/.codex/config.toml` 前会创建时间戳备份

<br>

## ⚙️ 安装部署

### 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/WangHaowen99/codex-deck/develop/install.sh | bash
```

默认安装到：

```text
~/.local/bin/cdx
```

如果 `~/.local/bin` 不在 `PATH` 中，加入 shell 配置：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### 依赖检查

```bash
python3 --version
tmux -V
codex --version
```

### 手动安装

```bash
git clone https://github.com/WangHaowen99/codex-deck.git
cd codex-deck
git checkout develop
chmod +x cdx install.sh
./install.sh
```

### 指定安装目录

```bash
INSTALL_DIR=/usr/local/bin ./install.sh
```

### 跳过初始化

```bash
CDX_SKIP_INIT=1 ./install.sh
```

之后手动初始化：

```bash
cdx init
```

<br>

## 🛠️ 常用命令

```bash
cdx                       # 打开菜单
cdx list                  # 列出 cdx 会话
cdx new [cdx_name]        # 新建会话；同名则进入
cdx enter [cdx_name]      # 进入会话
cdx delete [cdx_name]     # 删除 cdx 映射并 kill tmux
cdx rename [OLD NEW]      # 重命名
cdx roots                 # 管理常用目录
cdx map                   # 手动映射/导入 Codex 原始会话
cdx doctor                # 只报告状态问题
cdx init                  # 初始化并安装 hook
cdx install-hook          # 安装/刷新 Codex hook
```

<br>

## 🧪 状态检查

```bash
cdx doctor
```

检查内容包括：

- 配置文件是否存在、JSON 是否有效
- 注册表是否存在、JSON 是否有效
- `codex_hooks` 是否启用
- `SessionStart` hook 是否安装
- root 名和路径是否重复
- Codex session id 是否重复绑定
- tmux session 是否 live
- `last_cwd` 是否还存在

`doctor` 只报告，不自动修复。

<br>

## 🧹 卸载

删除命令：

```bash
rm -f ~/.local/bin/cdx
```

删除 Codex Deck 数据：

```bash
rm -rf ~/.config/cdx ~/.local/share/cdx ~/.local/state/cdx
```

如需手动清理 Codex hook，请编辑：

```text
~/.codex/hooks.json
~/.codex/config.toml
```

Codex Deck 不会删除 Codex 原始 conversation 历史。

