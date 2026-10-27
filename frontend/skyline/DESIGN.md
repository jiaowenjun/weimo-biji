---
version: alpha
name: biji-skyline-design-analysis
description: 基于 Skyline 的备忘录应用设计语言：暖色石质页面画布、白色圆角卡片、单一柿子橙品牌强调色，以及导航、抽屉、浮动按钮和底部工具栏上反复出现的磨砂玻璃质感。界面追求平静、有触感、偏编辑感，而非仪表盘风格——密集内容置于宽松卡片中，排版保持系统原生且克制，动效依赖轻微抬升、缩放、模糊与触觉反馈，而非高饱和色彩。
platform: WeChat Mini Program (Skyline, glass-easel)
units: 除非另有说明，单位为 rpx

colors:
  bg-page-light: "#f6f4f1"
  bg-page-dark: "#111111"
  bg-card-light: "#ffffff"
  bg-card-dark: "#1e1e1e"
  bg-elevated-dark: "#2a2a2a"
  bg-sidebar-light: "rgba(255, 255, 255, 0.9)"
  bg-sidebar-dark: "rgba(30, 30, 30, 0.9)"
  mask-light: "rgba(0, 0, 0, 0.4)"
  mask-dark: "rgba(0, 0, 0, 0.6)"
  brand-light: "#ca5421"
  brand-dark: "#f08646"
  brand-wash-light: "#faece5"
  brand-wash-dark: "#3a2a20"
  brand-chip-light: "#fef7f3"
  brand-chip-dark: "#3e3228"
  text-primary-light: "rgba(0, 0, 0, 0.9)"
  text-primary-dark: "rgba(255, 255, 255, 0.9)"
  text-secondary-light: "rgba(0, 0, 0, 0.6)"
  text-secondary-dark: "rgba(255, 255, 255, 0.55)"
  text-placeholder-light: "rgba(0, 0, 0, 0.26)"
  text-placeholder-dark: "rgba(255, 255, 255, 0.26)"
  border-light: "rgba(0, 0, 0, 0.06)"
  border-dark: "rgba(255, 255, 255, 0.08)"
  highlight-light: "#fff3b0"
  highlight-dark: "rgba(240, 134, 70, 0.38)"
  danger-light: "#d54941"
  danger-dark: "#e34d59"
  success-light: "#2ba471"
  success-dark: "#3ac57a"
  paper-light: "#eee8e8"
  paper-dark: "#2e2e29"

typography:
  hero:
    fontFamily: "WeChat system sans-serif"
    fontSize: 54rpx
    fontWeight: 600
    lineHeight: 1.2
  display-metric:
    fontFamily: "WeChat system sans-serif"
    fontSize: 56rpx
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.05em
  title-xl:
    fontFamily: "WeChat system sans-serif"
    fontSize: 46rpx
    fontWeight: 600
    lineHeight: 1.2
  title-lg:
    fontFamily: "WeChat system sans-serif"
    fontSize: 38rpx
    fontWeight: 600
    lineHeight: 1.35
  title-md:
    fontFamily: "WeChat system sans-serif"
    fontSize: 34rpx
    fontWeight: 650
    lineHeight: 1.35
  body:
    fontFamily: "WeChat system sans-serif"
    fontSize: 30rpx
    fontWeight: 400
    lineHeight: 1.5
  body-reading:
    fontFamily: "WeChat system sans-serif"
    fontSize: 30rpx
    fontWeight: 400
    lineHeight: 1.6
  body-relaxed:
    fontFamily: "WeChat system sans-serif"
    fontSize: 30rpx
    fontWeight: 400
    lineHeight: 1.7
  body-sm:
    fontFamily: "WeChat system sans-serif"
    fontSize: 26rpx
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "WeChat system sans-serif"
    fontSize: 24rpx
    fontWeight: 400
    lineHeight: 1.25
  code:
    fontFamily: "Menlo, Monaco, Consolas, monospace"
    fontSize: 26rpx
    fontWeight: 400
    lineHeight: 1.7
  share-print:
    fontFamily: "JingHuaLaoSong, serif"
    fontSize: 30rpx
    fontWeight: 400
    lineHeight: 1.6

rounded:
  sm: 12rpx
  md: 32rpx
  lg: 40rpx
  pill: 999rpx
  circle: 50%

spacing:
  xs: 8rpx
  sm: 16rpx
  md: 26rpx
  lg: 32rpx
  xl: 48rpx
  page-inline-padding: 28rpx
  card-gutter: 26rpx
  safe-bottom-rest: 48rpx

motion:
  card-press: "scale(1.03), 300ms cubic-bezier(0.2, 0, 0.4, 1)"
  card-lift: "scale(1.02), 200ms cubic-bezier(0.2, 1.2, 0.4, 1)"
  chrome-fade: "200-250ms ease-out"
  popover-enter: "scale(0.7 -> 1), 280ms cubic-bezier(0.34, 1.56, 0.64, 1)"
  fab-hover: "scale(0.95), 280-400ms ease"
  toolbar-slider: "260ms cubic-bezier(0.4, 0, 0.2, 1)"

components:
  surface-card:
    backgroundColor: "{colors.bg-card-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    border: "1rpx solid rgba(0, 0, 0, 0.04)"
    shadow: "0 2rpx 8rpx rgba(0, 0, 0, 0.035)"
    padding: 26rpx
  surface-floating-frosted:
    backgroundColor: "transparent + frosted gradient overlay"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md}"
    border: "1rpx solid rgba(0, 0, 0, 0.06)"
    shadow: "inset highlight + mid shadow + large soft shadow"
    blur: 28rpx
  nav-overlay:
    backgroundColor: "{colors.bg-sidebar-light}"
    textColor: "{colors.text-secondary-light}"
    typography: "{typography.title-md}"
    rounded: "{rounded.sm}"
    behavior: "自定义导航，可选透明到磨砂的过渡"
  memo-card:
    backgroundColor: "{colors.bg-card-light}"
    textColor: "{colors.text-primary-light}"
    typography: "{typography.body-reading}"
    rounded: "{rounded.md}"
    padding: 26rpx
  chip-brand-soft:
    backgroundColor: "{colors.brand-chip-light}"
    textColor: "{colors.brand-light}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "8rpx 16rpx"
  icon-button-glass:
    backgroundColor: "transparent + frosted surface"
    textColor: "{colors.brand-light} or {colors.text-primary-light}"
    rounded: "{rounded.pill}"
    size: 64rpx to 104rpx
  popover-menu:
    backgroundColor: "frosted floating panel"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.lg}"
    padding: "8rpx 16rpx"
  bottom-toolbar:
    backgroundColor: "none; individual controls float above the page"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.md} and {rounded.pill}"
    minHeight: 88rpx
  share-paper:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.text-primary-light}"
    typography: "{typography.body-reading}"
    rounded: "none"
    padding: "1.5em 40rpx"
---

## 概述

本文档反映截至 2026-06-10 的当前 `biji-skyline` 实现。UI 语言以**平静的笔记体验**为中心，而非效率工具式的表演感：柔和的页面背景、轻量的卡片阴影、克制的强调色、密集但可呼吸的阅读布局，以及类 iOS 的浮动界面元素。整体更像一本带精致移动端交互的个人笔记本，而不是实用仪表盘。

视觉系统由四个反复出现的理念驱动：

- **暖色石质画布**：多数页面在浅色模式下使用 `{colors.bg-page-light}`，深色模式下使用近黑中性色，避免纯白应用外壳。
- **白色圆角内容面**：备忘录、设置分组和许多状态都以大圆角矩形表达，而非通栏列表。
- **柿子橙作为唯一强调色**：`{colors.brand-light}` / `{colors.brand-dark}` 仅用于主操作、选中标签、热力图强度、链接和少数象征性状态。
- **磨砂浮动界面元素**：导航遮罩、侧边栏、浮动操作按钮、底部搜索栏、撰写工具栏和分享控件均使用透明背景加模糊、边框和分层阴影，而非实心栏。

**关键特征：**

- 平静、纸感页面背景，而非刺眼的纯白。
- 大圆角表面：`32rpx` 卡片、`40rpx` 抽屉与菜单、`999rpx` 标签与胶囊形控件。
- 系统原生无衬线排版，分享图片中有一处特例印刷衬线体。
- 全局自定义导航：居中标题、透明遮罩，模态流程中使用玻璃质感返回按钮。
- 备忘录卡片作为标准内容原语。
- 左侧停靠的半透明侧边栏，含统计、热力图、分面和标签树。
- 底部浮动输入/工具控件，而非沉重的固定顶栏或 Tab 栏。
- 通过短触觉反馈、缩放/抬升动效和按压玻璃态实现有触感的交互。

## 色彩与材质

浅色主题使用**暖色米白页面**（`#f6f4f1`）和**纯白卡片**。这一组合让卡片呈现安静的「纸放在桌面上」关系。品牌橙（`#ca5421`）刻意稀疏使用，不会铺满整个界面。它出现在主操作按钮填充、激活标签、筛选状态、热力图单元格、Markdown 链接和部分图标中。

深色主题并非直接反色。它切换为**炭灰页面背景**（`#111111`、`#1e1e1e`、`#2a2a2a`）和更亮的橙色强调色（`#f08646`），保持相同层级同时保留暖感。磨砂表面在两种主题下均保持半透明，通过不同的高光与边框行为区分，而非单独一套组件样式。

材质通过三种表面族表达：

1. **页面画布**：平坦、安静、暖色、无纹理。
2. **卡片表面**：不透明、圆角、轻边框，浅色模式下有淡淡阴影，深色模式下几乎仅依赖边框。
3. **浮动磨砂表面**：透明填充加 `backdrop-filter`、柔和边缘边框和分层阴影；用于应悬浮于内容之上的元素。

## 排版

排版刻意保守。多数 UI 文案使用平台默认无衬线字体。系统更依赖**字号、间距和颜色**，而非字体族变化。

- **正文**默认为 `30rpx`，行高 `1.5-1.7`。
- **备忘录阅读文本**使用 `1.6` 行距和两端对齐，使笔记更有编辑感而非聊天感。
- 侧边栏中的**大号指标**使用 `56rpx`、`600` 字重和负字距，在数据密集感下仍不切换展示字体。
- **Markdown 标题**居中而非左对齐，赋予备忘录内容反思式、便签卡式的气质，而非文档编辑器感。
- **代码**在带边框的中性块内使用 `Menlo, Monaco, Consolas, monospace`。
- **分享纸面印刷模式**切换为 `JingHuaLaoSong`，与系统字体形成刻意对比，是应用中最强的排版手势。

## 形状、间距与布局语法

形状系统简单且一致：

- `12rpx`：内联代码、小标签和滑块内部的小圆角。
- `32rpx`：默认卡片和字段外壳圆角。
- `40rpx`：大型浮动面板和弹出菜单外壳。
- `999rpx`：胶囊形、圆形图标按钮、导航触发器和分段控件。

间距遵循**外部留白大、内部密度紧凑**：

- 主页面内边距为 `28rpx`。
- 列表间距和卡片节奏由 `26rpx` 驱动。
- 底部浮动控件位于安全区之上再加 `48rpx`。
- 卡片通常使用 `26rpx` 内边距，形成宽松内容块而不显过大。

主要页面语法有三类：

1. **带内边距的页面外壳**：登录、设置、账户页。
2. **通栏列表页**：首页信息流、搜索、详情关联，卡片浮于全高滚动容器内。
3. **模态编辑页**：撰写、标签选择、分享图片和应用内详情，均带透明导航遮罩和底部浮动控件。

## 核心组件

### 备忘录卡片

`memo-card` 是产品中心。它将时间戳、内容、标签、引用和溢出操作合并在同一圆角表面。其行为与外观同等重要：

- 按压缩放至 `1.03`；抬升缩放至 `1.02` 并增大阴影。
- 标签为独立可按压胶囊，有各自的抬升状态。
- 引用预览为从属的元数据行，带方向图标。
- 内容可为纯文本或 `rich-text` Markdown 渲染输出。

备忘录卡片应始终像**可被抬起的实体卡片**，而非扁平列表行。

### 导航

应用几乎处处使用自定义导航。标题居中、色调低调、常为次要色而非纯黑粗体。这使界面元素保持安静，让内容承担视觉重量。

主要导航模式：

- **列表页**：透明导航，滚动时变为磨砂遮罩。
- **模态页**：透明导航，带渐变状态栏遮罩和左侧玻璃返回按钮。
- **分享入口详情页**：普通顶部导航，使用首页按钮而非模态玻璃处理。

标题菜单为紧凑弹出层，直接附着于居中标题。这强化「标题代表当前筛选上下文，而不只是标签」的理念。

### 侧边栏

首页侧边栏为半透明左侧抽屉，右侧圆角。它混合三种 UI 调性：

- 大号数字指标。
- 使用品牌强度渐变的微型贡献热力图单元格。
- 带引导线和轻微选中背景的分层标签/分面行。

这是应用中最「信息密集」的区域，但仍避免仪表盘式配色，一切保持在暖中性/橙色调内。

### 按钮、标签与图标按钮

控件系统刻意收窄：

- **`weimo-button`** 处理实心、描边、柔和、文本和卡片变体。
- **`weimo-chip`** 处理标签、筛选和编辑器标签控件。
- **`weimo-icon-button`** 承载多数高频控件，尤其是玻璃和透明（ghost）变体。
- **`weimo-toggle-button`** 专用于撰写 Markdown 工具栏。

模式：

- 实心品牌按钮应少量使用，传达「确认/提交」类操作。
- 描边品牌按钮用于重试和次要确认流程。
- 柔和品牌标签使用淡橙底，而非全橙填充。
- 玻璃图标按钮是模态页和浮动工具栏的标志性控件样式。

### 弹出菜单

菜单为大圆角磨砂面板，带缩放入场动画。它们不是小型工具菜单，而像迷你浮动面板。行距宽松，图标对齐于固定槽位，区块标题可折叠。即使溢出菜单也呈现精心打磨、产品化的质感。

### 空态与错误态

这些状态为居中、垂直内边距的堆叠布局，装饰极少：

- 空态：清晰标题、次要描述、可选胶囊形主操作按钮。
- 错误态：危险图标、柔和说明、描边重试按钮。

视觉信息是「平静的中断」，而非「警报」。

## 页面族

### 首页信息流

首页表达完整视觉语言：

- 全高自定义滚动区域
- 透明到磨砂的导航遮罩
- 导航下方的筛选标签
- 动态列表中的备忘录卡片
- 导航内左侧搜索入口
- 居中磨砂浮动操作按钮（仅自己范围）
- 左侧侧边栏：个人资料、指标、热力图、分面和标签树

首页应像应用默认的停留态。

### 搜索

搜索保留备忘录卡片列表语法，但将主交互移至**底部磨砂搜索工具栏**。关键词、标签和日期控件共享一条浮动条。页面标题仍反映当前标签范围，但搜索图标保留在导航中以维持模式身份。

### 撰写

撰写是应用最简化的页面：

- 全高写字区域
- 标签胶囊行
- 可选单条引用行
- 底部浮动 Markdown 工具栏
- 一个玻璃保存/发送按钮
- 透明导航遮罩上的模态玻璃返回按钮

此页刻意避免编辑器周围可见边框。应感觉开放、即时，工具浮于写作周围而非框住它。

### 详情与引用视图

详情页介于模态层与阅读表面之间。根备忘录位于关联内容之上，关联切换通过底部分段胶囊完成。这使关联模式切换保持在页面内、有触感，而非移入导航。

仅引用模式将卡片直接平铺进内容流，仍遵循相同备忘录卡片规则。

### 标签选择

这些页面复用相同模态语法：

- 全高列表
- 透明导航遮罩
- 底部浮动磨砂输入外壳
- 单一确认或搜索入口

它们刻意精简、偏工具向，但仍继承系统相同的玻璃 + 圆角几何。

### 分享图片

分享图片页是产品中最强的视觉变体。它将备忘录内容转为可印刷纸面成品：

- 去饱和纸面背景（浅色模式 `#eee8e8`）
- 可选标签、日期、昵称和小品牌签名
- 可选印刷衬线（`JingHuaLaoSong`）
- 大号居中玻璃分享按钮
- 可见性与排版切换的选项菜单

应感觉不像「导出截图」，而像「准备一张设计好的卡片」。

### 登录、设置

这些页面结构更简单：

- 标准自定义导航
- 带内边距的页面外壳
- 堆叠卡片分组
- 清晰的图标引导行

登录页增加更偏编辑感的首屏区，大号两行标题文案。设置页更安静、更偏实用，但仍使用相同卡片、图标和橙色强调语言。

## 内容渲染规则

富文本和 Markdown 渲染是 UI 身份的重要部分。当前规则形成非常特定的阅读风格：

- 段落两端对齐
- 标题居中且更重
- 引用块为次要色，可左对齐或居中
- 列表为自定义渲染，而非原生样式
- 代码块使用页面色面板，而非深色语法块
- 链接为橙色并带下划线
- 高亮使用淡黄或深色模式下的橙色光晕

这使笔记介于笔记本、引用卡和轻量文章编辑器之间。

## 交互原则

UI 有触感但克制：

- 短触觉反馈确认重要控件的点击。
- 卡片和标签行抬升，而非仅改变透明度。
- 玻璃控件在按压下变亮，而非改色。
- 浮动操作按钮和工具按钮在悬停/按压时略缩小。
- 弹出层从锚点缩放，而非突然出现。

应用应感觉**柔和、可触摸、安静**，从不显得急促或游戏化。

## 与实现耦合的设计约束

这些设计决策与 Skyline 实现紧密耦合，应予以保留：

1. **磨砂表面依赖透明加模糊**。用不透明灰填充替换会改变整个产品调性。
2. **模态导航标题绝对居中**，因左右操作区宽度不对称。标准 Flex 居中在视觉上不正确。
3. **键盘避让发生在外层容器或浮动工具栏**，而非依赖原生页面滚动解决。
4. **富文本必须使用 `mode="compat"` 和显式文字颜色**，尤其用于分享图片和 Markdown 内容。
5. **详情、撰写、选择器和分享页依赖透明导航遮罩**，使顶部界面元素在内容上保持轻盈通透。
6. **分享纸面保留右侧遮盖条**，以隐藏快照输出中的导出接缝。

## 文案调性

文案风格简短、平静、直白。标题通常一两个词：

- `搜索笔记`
- `笔记详情`
- `批注`
- `新建`
- `编辑`
- `分享`
- `设置`

产品避免戏谑俚语或企业腔措辞。即使状态文案也保持直接：`正在加载...`、`重试`、`已加载全部笔记`。

## 该做 / 不该做

**该做：**

- 保持橙色为唯一强强调色。
- 优先暖中性色而非蓝灰。
- 使用大圆角和充足的安全区间距。
- 让重要控件以磨砂对象形式浮动。
- 保留备忘录卡片抬升/按压行为。
- 保持阅读文本宽松且两端对齐。

**不该做：**

- 引入第二种饱和品牌色。
- 将模态工具栏改为全宽实心栏。
- 把备忘录文案收紧为聊天式行距。
- 用直角矩形替换圆角卡片几何。
- 在浅色模式下过度使用重阴影或深色半透明填充。

## 待清理事项

- `home-sidebar/index.wxss` 引用了 `--color-brand-strong`，但共享设计令牌文件目前定义的是 `--color-brand` 及相关品牌变体，而非 `--color-brand-strong`。后续令牌清理应正式添加该令牌，或替换为已声明的值。
- 分享纸面刻意使用页面专用纸色，而非全局卡片令牌。这种差异是正确的，但应隔离在分享图片相关工作内。
