# dsh-client-ui-quote

A selection-quoting plugin for the DeepSeek Harness web GUI: select text inside an AI reply and attach it to your next message as a quote banner.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)

## Table of Contents

- [Features](#features)
- [Preview](#preview)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [License](#license)

## Features

- **Selection toolbar** — one 引用 (Quote) button appears above the selection after a 50ms debounce, so it never flashes mid-drag. It hides on Escape, scroll-away, or when the selection collapses.
- **Quote banner** — a removable strip above the composer with a quote glyph, the quoted text, and a × button. The quote is consumed by the next send: the banner clears when the message goes out.
- **Clean draft** — the quote is a pending-send attachment, not text in your input. Focus returns to the composer so typing follows.
- **Localized** — toolbar labels and the quote attribution follow the UI language (中文 / English).
- **Fallback for older harnesses** — on versions without the input-machine quote attachment, the button inserts the quote block at the end of the draft instead.

## Preview

![Toolbar above a selected AI reply](assets/preview-1.png)

![Quote banner above the composer](assets/preview-2.png)

## Installation

### Prerequisites

- DeepSeek Harness with the web GUI (`dsh web`)
- Full banner behavior needs `@deepseek-ai/dsh-client-ui-conversation` with the input-machine quote attachment (`InputActions.setQuote`). Older versions fall back to inserting the quote into the draft.

### Install

```sh
dsh plugin --profile web add https://github.com/skyhancloud/dsh-client-ui-quote
```

Then restart `dsh web` and refresh the browser.

## Usage

1. Select any text inside an AI reply.
2. Click **引用** (Quote) above the selection — the quote appears as a banner above the composer.
3. Type your message and send — the quote is prepended to the outgoing message:

```
> 引用 AI 回复：
> <selected lines>

<your message>
```

4. Click × on the banner when you no longer need the quote.

## Development

```sh
pnpm install
pnpm run bundle   # emits lib/index.js and lib/client.js
```

Pull requests are welcome.

## License

MIT — see [LICENSE](LICENSE).

## 中文

为 DeepSeek Harness 网页界面（`dsh web`）提供选中引用功能：选中 AI 回复中的文字，把引用附加到你的下一条消息。

**功能**

- 选中 AI 回复中的文字，选区上方出现一个 **引用** 按钮（50ms 防抖，拖选时不闪现；按 Esc、滚动离开或选区折叠时隐藏）。
- 引用横幅：输入框上方的可移除条带，带引用标记、引用文本和 × 按钮。引用在下一次发送时被消耗——消息发出后横幅自动消失。
- 草稿保持干净：引用是待发送附件，不会写进输入框；点击后焦点回到输入框。
- 界面文案与引用内容跟随 UI 语言（中文 / English）。
- 兼容旧版：输入机没有引用附件时，按钮改为把引用块插入草稿末尾。

**安装**

```sh
dsh plugin --profile web add https://github.com/skyhancloud/dsh-client-ui-quote
```

重启 `dsh web` 并刷新浏览器。

**使用**

1. 选中 AI 回复中的任意文字。
2. 点击选区上方的 **引用**，引用会以横幅形式出现在输入框上方。
3. 输入你的消息并发送——引用会前置到发出的消息上：

```
> 引用 AI 回复：
> <选中的行>

<你的消息>
```

4. 不需要时点击 × 关闭横幅。

**许可证**

MIT — 见 [LICENSE](LICENSE)。
