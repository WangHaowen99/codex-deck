<div align="center" id="codex-deck">

<img src="_image/app_icon.png" alt="Codex Deck App Icon" width="140">

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
| [📦 版本发布](#-版本发布) | [🛠️ 常用命令](#️-常用命令) | [🧹 卸载](#-卸载) |

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

## 📦 版本发布

### v0.1.15 - 最新对话置顶

- 下载：[codex-deck-vscode-0.1.15.vsix](releases/codex-deck-vscode-0.1.15.vsix)
- 更新：VS Code 侧边栏按最近对话更新时间排序，最新有对话活动的 cdx 会话会自动置顶；无对话更新时间时回退到最近使用时间。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.15.vsix
```

### v0.1.14 - Fork Codex 会话

- 下载：[codex-deck-vscode-0.1.14.vsix](releases/codex-deck-vscode-0.1.14.vsix)
- 更新：`cdx` 新增 `fork` 命令；VS Code 侧边栏右键新增 “Fork Session”，可基于已有 Codex 会话创建新的 cdx 会话并打开新终端。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.14.vsix
```

### v0.1.13 - 调用详情与压缩详情

- 下载：[codex-deck-vscode-0.1.13.vsix](releases/codex-deck-vscode-0.1.13.vsix)
- 更新：tooltip 指标改为中文，并在提示中说明右键可查看固定详情页；侧边栏右键新增“查看调用失败原因”“查看工具调用详情”“查看压缩详情”，可检查失败原因、shell 命令、web 搜索、patch 修改、工具分布，以及每次压缩后的摘要和保留历史。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.13.vsix
```

### v0.1.12 - Agent 动作分析指标

- 下载：[codex-deck-vscode-0.1.12.vsix](releases/codex-deck-vscode-0.1.12.vsix)
- 更新：`cdx list --json` 和 VS Code 侧边栏新增压缩次数、工具调用次数、缓存命中率和失败次数；tooltip 展示 shell / web / patch / subagent 分布、编辑文件数、命令成功率、命令耗时、最近一轮耗时和首 token 延迟。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.12.vsix
```

### v0.1.11 - 指标显示兜底修复

- 下载：[codex-deck-vscode-0.1.11.vsix](releases/codex-deck-vscode-0.1.11.vsix)
- 更新：VS Code 插件会在远端 `cdx` 还未返回指标字段时，从 Codex transcript 兜底解析总 token、对话轮数和上下文占比；侧边栏指标文案也改为更短格式，减少窄侧边栏裁剪。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.11.vsix
```

### v0.1.10 - 会话指标显示

- 下载：[codex-deck-vscode-0.1.10.vsix](releases/codex-deck-vscode-0.1.10.vsix)
- 更新：`cdx list --json` 新增总 token 数、对话轮数和当前上下文占比；VS Code 侧边栏和 tooltip 同步显示这些会话指标。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.10.vsix
```

### v0.1.9 - 运行中橙点与稳定排序

- 下载：[codex-deck-vscode-0.1.9.vsix](releases/codex-deck-vscode-0.1.9.vsix)
- 更新：VS Code 侧边栏中，Codex 运行中的会话改为橙色圆点，不再使用加载动画；会话列表按创建时间稳定排序，不再因为最近访问而跳到最上方。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.9.vsix
```

### v0.1.8 - 新会话绑定兜底修复

- 下载：[codex-deck-vscode-0.1.8.vsix](releases/codex-deck-vscode-0.1.8.vsix)
- 更新：`cdx` 新增 shell snapshot 兜底绑定；Codex 新版本未执行 `SessionStart` hook 时，新建会话仍会自动拿到真实 Codex session id，从而恢复 VS Code 侧边栏红点/绿点显示。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.8.vsix
```

### v0.1.7 - hooks 与运行状态同步发布

- 下载：[codex-deck-vscode-0.1.7.vsix](releases/codex-deck-vscode-0.1.7.vsix)
- 更新：重新打包最新 VS Code 扩展；配合当前 cdx 运行时的 `[features].hooks` 和 `activity_state` 输出，恢复新建会话绑定后的红点/绿点/运行动画显示。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.7.vsix
```

### v0.1.6 - 运行中动画修复

- 下载：[codex-deck-vscode-0.1.6.vsix](releases/codex-deck-vscode-0.1.6.vsix)
- 更新：修复运行中的 Codex 会话在 VS Code 侧边栏左侧没有动画的问题；运行时长改为在插件侧本地递增刷新。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.6.vsix
```

### v0.1.5 - Codex hooks 配置兼容

- 下载：[codex-deck-vscode-0.1.5.vsix](releases/codex-deck-vscode-0.1.5.vsix)
- 更新：重新打包 VS Code 扩展版本；仓库同步 Codex 新版 `[features].hooks` 配置兼容修复。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.5.vsix
```

### v0.1.4 - 运行状态与任务时长

- 下载：[codex-deck-vscode-0.1.4.vsix](releases/codex-deck-vscode-0.1.4.vsix)
- 更新：侧边栏显示 Codex 运行中加载动画与已运行时长；完成后按未读/已读显示红点/绿点，不再显示 live、bound、viewed 文本。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.4.vsix
```

### v0.1.3 - 点击即清除未读

- 下载：[codex-deck-vscode-0.1.3.vsix](releases/codex-deck-vscode-0.1.3.vsix)
- 更新：VS Code 打开或复用会话终端时会调用 `cdx mark-viewed`，确保未读红点及时清除。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.3.vsix
```

### v0.1.2 - 复用 VS Code 终端

- 下载：[codex-deck-vscode-0.1.2.vsix](releases/codex-deck-vscode-0.1.2.vsix)
- 更新：点击同一个 cdx 会话时复用已有 VS Code 终端，不再重复新建终端连接。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.2.vsix
```

### v0.1.1 - 未读提醒

- 下载：[codex-deck-vscode-0.1.1.vsix](releases/codex-deck-vscode-0.1.1.vsix)
- 更新：cdx 会话列表和 VS Code / Remote SSH 侧边栏支持未查看 Codex 结果提醒。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.1.vsix
```

### v0.1.0 - VS Code 扩展预览版

- 下载：[codex-deck-vscode-0.1.0.vsix](releases/codex-deck-vscode-0.1.0.vsix)
- 用途：在 VS Code / Remote SSH 侧边栏里查看、新建、进入、重命名和删除 Codex Deck 会话。
- 安装：

```bash
code --install-extension releases/codex-deck-vscode-0.1.0.vsix
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
| 未读提醒 | transcript 晚于上次进入时间时，在 cdx 列表和 VS Code 插件里显示未查看结果 |
| 运行状态 | VS Code 侧边栏显示 Codex 运行中动画和已运行时长 |
| 鼠标滚动 | cdx 会刷新 tmux 鼠标模式并接管滚轮，避免滚轮事件被 Codex 当成上下键 |
| UUID 查询 | 直接显示某个 cdx 会话绑定的 Codex session id |
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
~/.codex/config.toml   # 启用 features.hooks
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
cdx mark-viewed [cdx_name] # 标记未读结果为已查看
cdx uuid [cdx_name]       # 查看绑定的 Codex session id
cdx uuid --all            # 列出所有 cdx 会话的绑定 UUID
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
- `hooks` feature 是否启用
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
