# biji-skyline 内嵌图标字体

本目录下的 `iconfont.wxss` 通过 `data:font/ttf;base64,...` 内嵌的字体，是 [Tencent TDesign Icons](https://github.com/Tencent/tdesign-icons) 字体的子集，经 cmap 重映射、name 表改名、**glyph 几何居中 + 垂直 metrics 对称化**后形成项目内部字体 `biji-icon`。原作品由 Tencent 以 [MIT 许可](https://github.com/Tencent/tdesign-icons/blob/develop/LICENSE) 发布。

## 字体源版本指纹

- 来源 URL：`https://tdesign.gtimg.com/icon/0.4.2/fonts/t.ttf`
- 同步参考包：`tdesign-miniprogram@1.13.2`（用其 `miniprogram_dist/icon/icon.wxss` 解析 name → 原码位映射）
- `tdesign.ttf` md5：`dee0a3769d297b3ba8e2715e22c9fc5c`
- `biji-icon.ttf` md5：`7d516b1d3ed125eb6536575bf43818c5`（含 glyph 居中变换）
- 子集化后字节数：约 7.9 KB（8112 B）；base64 数据段约 10.6 KB（10816 字符）

## glyph 居中处理（v2）

原 tdesign 字体 `unitsPerEm = 1024`，`hhea.ascent = 1024 / descent = 0`（baseline 在 line-box 底部），且每个 glyph 的实际 contour 在 em-square 中**水平靠左、垂直靠下**（如 `chevron-right` contour 仅 (334, 0) 到 (690, 808)）。在 CSS `line-height: 1` 的 inline-box 中，字符既不在 box 几何中心，且各 glyph 偏移量还各不相同，导致 `display: flex; align-items: center` 居中后视觉上字符仍然偏移、且无法用统一 CSS 修正。

`build-font.py` 在子集化后做两步几何变换：

1. **每个 glyph contour 平移到 em-square 几何中心**：取实际 contour 的 (min/max x, min/max y) 算几何中心 `(cx, cy)`，整体平移 `(upem/2 - cx, -cy)`。平移后所有 glyph 的 contour 中心都恰好在 `(512, 0)`（baseline 上）。
2. **垂直 metrics 对称化**：`hhea.ascent = 512, descent = -512, lineGap = 0`；`OS/2 sTypoAscender = 512, sTypoDescender = -512, sTypoLineGap = 0, usWinAscent = 512, usWinDescent = 512`。这样 CSS `line-height: 1` 的 line-box 高度 = 1024，baseline 落在 line-box 几何中心。

两步组合的净效果：每个字符的 contour 几何中心 = inline-box 几何中心。任何 flex 居中容器都能让字符视觉居中，旋转 transform 也以字符视觉中心为轴。

## 子集 glyph 清单

下表给出 `tdesign 原 name → tdesign 原码位 → 项目私有区码位 → wxss 类名` 的映射。图标按名称字母序排列；已有码位保持稳定，新图标向后追加码位，避免复用旧码位。

| tdesign 原 name | 原码位 | 项目码位 | wxss 类名 |
| --- | --- | --- | --- |
| `add` | `\E00D` | `\e601` | `.iconfont--add` |
| `adjustment` | `\E011` | `\e602` | `.iconfont--adjustment` |
| `arrow-left-up-circle` | `\E06E` | `\e603` | `.iconfont--arrow-left-up-circle` |
| `arrow-left-up-circle-filled` | `\E06D` | `\e604` | `.iconfont--arrow-left-up-circle-filled` |
| `arrow-right-down-circle` | `\E074` | `\e62b` | `.iconfont--arrow-right-down-circle` |
| `arrow-right-down-circle-filled` | `\E073` | `\e605` | `.iconfont--arrow-right-down-circle-filled` |
| `arrow-up-down-1` | `\E080` | `\e606` | `.iconfont--arrow-up-down-1` |
| `arrow-up-down-circle` | `\E084` | `\e607` | `.iconfont--arrow-up-down-circle` |
| `bulletpoint` | `\E103` | `\e608` | `.iconfont--bulletpoint` |
| `calendar` | `\E11B` | `\e609` | `.iconfont--calendar` |
| `calendar-event` | `\E119` | `\e60a` | `.iconfont--calendar-event` |
| `check` | `\E1BC` | `\e60b` | `.iconfont--check` |
| `chevron-down` | `\E1C8` | `\e60c` | `.iconfont--chevron-down` |
| `chevron-left` | `\E1D0` | `\e60d` | `.iconfont--chevron-left` |
| `chevron-right` | `\E1D8` | `\e60e` | `.iconfont--chevron-right` |
| `close` | `\E224` | `\e60f` | `.iconfont--close` |
| `close-circle-filled` | `\E21E` | `\e610` | `.iconfont--close-circle-filled` |
| `copy` | `\E273` | `\e62c` | `.iconfont--copy` |
| `delete` | `\E2BF` | `\e611` | `.iconfont--delete` |
| `edit` | `\E2FE` | `\e612` | `.iconfont--edit` |
| `ellipsis` | `\E303` | `\e613` | `.iconfont--ellipsis` |
| `enter` | `\E308` | `\e62a` | `.iconfont--enter` |
| `error-circle` | `\E30B` | `\e614` | `.iconfont--error-circle` |
| `format-vertical-align-center` | `\E3EE` | `\e615` | `.iconfont--format-vertical-align-center` |
| `gesture-click` | `\E410` | `\e616` | `.iconfont--gesture-click` |
| `grid-view` | `\E451` | `\e617` | `.iconfont--grid-view` |
| `hashtag` | `\E45C` | `\e618` | `.iconfont--hashtag` |
| `home` | `\E470` | `\e619` | `.iconfont--home` |
| `indent-right` | `\E49B` | `\e61a` | `.iconfont--indent-right` |
| `login` | `\E515` | `\e629` | `.iconfont--login` |
| `logo-miniprogram` | `\E544` | `\e61b` | `.iconfont--logo-miniprogram` |
| `logout` | `\E562` | `\e61c` | `.iconfont--logout` |
| `member` | `\E5B6` | `\e61d` | `.iconfont--member` |
| `notification` | `\E626` | `\e61e` | `.iconfont--notification` |
| `page-head` | `\E653` | `\e61f` | `.iconfont--page-head` |
| `quote` | `\E6C7` | `\e620` | `.iconfont--quote` |
| `refresh` | `\E6D6` | `\e621` | `.iconfont--refresh` |
| `search` | `\E71D` | `\e622` | `.iconfont--search` |
| `send-filled` | `\E722` | `\e623` | `.iconfont--send-filled` |
| `setting` | `\E733` | `\e624` | `.iconfont--setting` |
| `share` | `\E737` | `\e625` | `.iconfont--share` |
| `share-1` | `\E735` | `\e626` | `.iconfont--share-1` |
| `user-1` | `\E889` | `\e627` | `.iconfont--user-1` |
| `view-list` | `\E8F7` | `\e628` | `.iconfont--view-list` |

## 升级流程

1. 在 `tools/iconfont/biji-skyline-icons.txt` 中增删图标名（按字母序；新增图标向后分配 hex 值）。
2. 重跑 `build-mapping.js` + `build-font.py`，再将生成的 base64 更新到 `iconfont.wxss`。
3. 提交 commit 中附新的 `biji-icon.ttf` md5 到本文件。
