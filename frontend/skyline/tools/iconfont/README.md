# biji-icon 字体构建工具

本目录用于把 Tencent TDesign Icons 字体子集化为项目内嵌字体 `biji-icon`，并生成 `miniprogram/styles/iconfont.wxss` 所需的类名映射。

## 输入

- `biji-skyline-icons.txt`：每行 `name targetHex [sourceName]`，例如 `adjustment e612`
- `tdesign-miniprogram`：仅用于解析 `name -> 原码位(source)`（从 `icon/icon.wxss` 读取）
- `tdesign.ttf`：TDesign Icons 字体源文件

## 输出

- `mapping.json`：`[{ name, source, target }]`
- `biji-icon.ttf`：子集化 + cmap 重映射 + name 改名 + glyph 居中 + metrics 对称化后的字体

## 使用

在本目录安装依赖：

```bash
pnpm install
```

生成 `mapping.json`：

```bash
pnpm run mapping
```

准备 `tdesign.ttf`（放到本目录，文件名必须是 `tdesign.ttf`），然后生成 `biji-icon.ttf`：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install fonttools
pnpm run font
```

把 `biji-icon.ttf` base64 内嵌进 `miniprogram/styles/iconfont.wxss`：

```bash
base64 < biji-icon.ttf | tr -d '\n' > biji-icon.ttf.b64
```

用 `biji-icon.ttf.b64` 的内容替换 `iconfont.wxss` 的 `@font-face src: url("data:font/ttf;base64,...")`，并确保新增的 `.iconfont--<name>::before { content: "\\exxx"; }` 与 `biji-skyline-icons.txt` 的 target 一致。
