<div align="center">

# ⚓ 回神 · Back to Focus

**专为 ADHD 与深度阅读者打造的段落聚焦与注意力回神浏览器扩展**

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](#)
[![Design](https://img.shields.io/badge/Design-Apple_HIG_Aesthetic-000000?style=flat-square&logo=apple&logoColor=white)](#)
[![Dependencies](https://img.shields.io/badge/Dependencies-Zero_Dependency-success?style=flat-square)](#)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Local_Only-blueviolet?style=flat-square)](#)
[![Build and Package](https://github.com/xia0ne/adhd-back-to-focus/actions/workflows/package.yml/badge.svg)](https://github.com/xia0ne/adhd-back-to-focus/actions/workflows/package.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg?style=flat-square)](LICENSE)

<br />

> **“不向走神宣战，而是把‘找回注意力’的挫败感与摩擦力降到零。”**  
> 告别机械扫视（Zombie Scanning）与重读焦虑，用物理锚点与一键倒带守护每一次深度阅读。

<br />

</div>

---

## 💡 为什么需要「回神」？

对于 ADHD 特质读者与高强度信息工作者而言，最常见的挫败往往不是“走神”本身，而是：

1. **机械扫视（Zombie Scanning）**：眼睛在一行行往下移动，大脑却在神游，直到划过大半页才猛然惊醒。
2. **位置迷失与重读挫败**：惊醒后，面对密密麻麻的文字墙，根本不知道自己究竟从哪一段开始断片，只能烦躁地重新从头看或直接关掉网页。
3. **元认知羞耻感**：频繁发现自己走神会产生持续的自责与注意力焦虑。

**「回神 · Back to Focus」** 通过**逐段聚光灯**、**理解检查点**与**一键回神机制**，把阅读过程转化为轻量、可控的认知闭环。

---

## ✨ 核心特性

### 🎯 1. 逐段聚光灯聚焦（Paragraph Spotlight）
* 自动提取正文阅读单元，**当前段落高对比度呈现**，周围内容只降低透明度，不模糊，正文位置也不被挤开。
* 无论是点击悬浮框还是按方向键，视口都会把当前段**吸到偏上约三分之一**的舒适位置。

### ⚓ 2. 理解检查点（Comprehension Checkpoint）
* 读懂一段核心逻辑后，随手标记一个**晨曦琥珀色锚点（`⚓`）**。
* 它是给大脑工作记忆盖下的“已签收”实体印记，代表“我确实吸收到了这里”，而不是无意义的页面滚动进度。

### ↺ 3. 一键从容回神（Instant Snap Back）
* 读到第 15 段突然发现从第 8 段就已经走神？
* 点击悬浮框上的 **`[↺ 一键回神]`**，回到最近一次理解检查点。还没签收过时，回到上次在某一段停留超过 8 秒的位置。
* 跳过的段落会留下淡的琥珀色边，直到你再读到它们。

### ⏱ 4. 微感知耗时锚点（Pacing Anchor）
* 实时分析当前段落字数并测算用时（如 `⏱ 本段约 15 秒 · 80 字`）。
* 将庞大的文字墙拆解为“**只要专注 15 秒就能通关**”的微小颗粒度，轻松瓦解拖延与畏难障碍。

### 🎛 5. Apple 风格可折叠可拖拽悬浮窗（Floating Control Card）
* **拒绝廉价 AI 浮夸渐变**：遵循 Apple 人机交互规范（HIG），纯净超薄磨砂玻璃材质（`backdrop-filter: blur(30px)`）与微米级光边。
* **折叠态（Mini Pill）**：极简小胶囊（`⚓ 08/24`），可随意拖拽停靠在屏幕任意角落并**自动记住位置**，完全不遮挡正文。
* **展开态（Card Panel）**：包含上一段、下一段、读懂打卡与一键回神的**直观大按键**，单手鼠标点按即可完成所有操作。

### 🧠 6. 跨会话阅读记忆模式（Progress Memory Mode）
* **无缝续读**：按 `Esc` 退出、关闭标签页或刷新后，插件会自动固化当前阅读段落与检查点。
* 下次再次开启该页面时，**自动精准跳转至上次退出的段落**，彻底告别“重开网页重新找进度”的痛苦。
* 支持在悬浮窗进度旁点击 **`[重置]`** 随时从第 1 段从头开始。

### 🍅 7. ADHD 专注冲刺番茄钟（Micro-Pomodoro Sprint）
* **专为高启动阻力体质设计**：抛弃容易引起抗拒的传统 25 分钟长计时，精选 **10分钟（闪电冲刺）**、**15分钟（黄金微习惯）** 与 **25分钟（深度沉浸）** 挡位。
* **极简交互**：先把悬浮卡折成小胶囊，轻点胶囊上的 `⏳ 15:00` 启停，双击切换时长。时间到后胶囊变成 `☕ 休息`，点一下开始 3 分钟休息。

### 🤖 8. 深度适配主流 AI Web 对话平台
不仅支持常规新闻与博客长文，更专为长篇 AI 回复定制了解析适配器：
* 🟢 **ChatGPT (OpenAI)**：完美拆解多轮对话、项目列表与代码块保护
* 🟣 **Claude (Anthropic)**：适配流式文本与 Markdown 排版
* 🔵 **DeepSeek (深度求索)**：**智能折叠 Thinking 思考过程**，不打乱正式回答阅读线
* 🟡 **Gemini (Google)** & **Kimi (Moonshot)**：动态对话气泡与复杂引用解构

---

## ⌨️ 操作指引（双轨并存 · 零学习负担）

你可以完全依赖鼠标/触控板点按悬浮卡片，也可以使用键盘快速操作：

| 动作 | 触控板 / 鼠标操作 | 键盘快捷键 | 心理机制 |
| :--- | :--- | :---: | :--- |
| **快速进入聚焦** | **双击文章或 AI 回答任意段落** | `Alt + F` | 零摩擦原地启动 |
| **切换段落** | 点击卡片 `[↑ 上一段]` / `[↓ 下一段]` | `K` / `J` 或 `↑` / `↓` | 视口吸到舒适位置 |
| **签收理解** | 点击卡片 `[⚓ 读懂了 · 存检查点]` | `C` | 确认吸收，建立安全锚点 |
| **一键回神** | 点击卡片 `[↺ 一键回神]` | `R` | 跳过走神段落，倒带重读 |
| **折叠悬浮框** | 点击卡片右上角 `─`（或长按拖拽） | — | 缩入迷你胶囊，视野无遮挡。番茄钟在胶囊上的计时里 |
| **退出聚焦** | 点击卡片右上角 `✕` | `Esc` | 恢复原网页样式 |

---

## 🚀 安装与运行

本项目基于 **Chrome Extension Manifest V3** 纯原生开发，**零构建依赖、开箱即用**：

### 方式 A：直接下载安装包（推荐 · 免 Git）
1. 前往 **[GitHub Releases 页面](https://github.com/xia0ne/adhd-back-to-focus/releases)**。
2. 下载最新版本的 `adhd-back-to-focus-vX.X.X.zip` 并解压到本地任意目录。
3. 打开浏览器（Chrome / Edge / Brave / Arc 等），在地址栏输入 `chrome://extensions/` 并回车。
4. 开启右上角的 **“开发者模式” (Developer mode)** 开关。
5. 点击左上角 **“加载已解压的扩展程序” (Load unpacked)**，选择刚解压出来的文件夹即可！

### 方式 B：从源码安装（开发者）
1. 克隆代码仓库：
   ```bash
   git clone git@github.com:xia0ne/adhd-back-to-focus.git
   ```
2. 按照方式 A 的步骤 3~5，在浏览器中加载 `adhd-back-to-focus` 目录。

### 立即体验
* 打开任何长篇文章或 AI 网页（如 ChatGPT / Claude / DeepSeek）。
* **双击任意一段文字**（或按 `Alt + F`），开启纯净的回神之旅。

---

## 🤝 贡献指南（Contributing）

我们热烈欢迎所有针对 ADHD / 神经多样性（Neurodiversity）阅读体验的反馈、适配与功能改进！

### 贡献流程
1. **Fork** 本仓库到你的 GitHub 账号。
2. 创建你的特性分支：
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. 提交你的代码（请遵循清晰的 Commit Message 规范）：
   ```bash
   git commit -m 'feat: adapt new ai platform or improve spotlight'
   ```
4. 推送分支到你的远端仓库：
   ```bash
   git push origin feat/your-feature-name
   ```
5. 在 GitHub 上向本项目发起 **Pull Request (PR)**。

### 开发建议
* **保持克制与纯净**：尽量保持纯原生 JavaScript 与 CSS，不引入冗杂的重型第三方依赖。
* **遵循 Apple HIG 美学**：维持超薄磨砂玻璃、自然中性色阶与微米边框设计，避免添加带有视觉压迫感的强刺激元素。

---

## 👥 贡献者名单（Contributors）

非常感谢所有为「回神 · Back to Focus」贡献代码、提出建议与反馈想法的伙伴们！

<a href="https://github.com/xia0ne/adhd-back-to-focus/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=xia0ne/adhd-back-to-focus" alt="Contributors" />
</a>

* **项目发起人 / Maintainer**: [@xia0ne](https://github.com/xia0ne)
* 欢迎提交 PR，让你的头像出现在这里！

---

## 🔒 隐私与本地优先（Local-First）

* **100% 离线与本地运行**：扩展不会向任何外部服务器发送你的浏览内容、阅读历史或个人信息。
* **本地轻量统计**：注意力检查与回神次数仅加密缓存在浏览器原生的 `chrome.storage.local` 中，安全无忧。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 许可协议开源。
