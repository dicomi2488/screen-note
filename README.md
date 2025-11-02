# Screen Note

一个基于纯 Web 的全屏浮层画板（overlay canvas + 浮动工具球）。特性：

- 画笔 / 橡皮擦 / 指针工具
- 撤销 / 重做（矢量 stroke 历史）
- 高 DPI 适配（自动按设备像素比缩放）
- 透明背景 + 鼠标穿透（Win32 + WebView2 原生实现）

> 透明 & 鼠标穿透的“强控制”版本已通过 `win32/` 下原生宿主实现；Neutralino 版本仍保留（可运行），后续可能裁剪。

## 快速预览（纯浏览器）

直接打开 `index.html`，或启用本地静态服务（禁用缓存方便调试）：

```powershell
npx http-server -c-1 .
# 或
python -m http.server 8000
```

## Win32 + WebView2 原生透明宿主

目的：获得稳定、无黑边、可即时切换的鼠标穿透与真正全透明背景。

### 工作机制
前端通过 `window.chrome.webview.postMessage({ cmd: 'setPassthrough', enable })` 发送指令；
原生层接收并切换 `WS_EX_TRANSPARENT` 扩展样式，再回发：

```jsonc
{ "type": "passthroughAck", "ok": true, "enable": true }
```

JS 侧已有 Promise + 超时（约 1500ms）等待 ack，失败会回退到其它旧策略（后续会精简移除）。

### 前置准备
1. 安装 VS 2022（含“使用 C++ 的桌面开发”组件）或安装 Ninja + MSVC 编译工具链
2. 安装 [Microsoft Edge WebView2 Runtime]（一般系统已自带）
3. （推荐）安装 WebView2 SDK，并设置环境变量：
	 - `WEBVIEW2_SDK_ROOT = C:\path\to\Microsoft.Web.WebView2.<version>` （包含 `include/WebView2.h`）

### 构建
```powershell
cd win32
./build.ps1 -Config Release   # 或 Debug
```

脚本会优先使用 Ninja；若未找到则回退到 VS 生成器。成功后输出可执行文件路径：

- Ninja: `win32/build/ScreenNoteNative.exe`
- VS: `win32/build/Release/ScreenNoteNative.exe`

运行后会加载项目根目录的 `index.html`（默认全屏透明置顶）。

### 运行时调试
在 DevTools Console 可调用：

```js
chrome.webview.postMessage({ cmd: 'setPassthrough', enable: true });
```

收到 ack（监听 `message` 事件）即可确认：

```js
window.addEventListener('message', e => {
	if(e.data?.type === 'passthroughAck') console.log('ack:', e.data);
});
```

## Neutralino 版本（仍可使用）

仍可通过 Neutralino 运行（但鼠标穿透依赖脚本 / 方案较繁琐）：

```powershell
npm install
npx neu update
npm run neu:run
```

构建：

```powershell
npm run neu:build
```

输出在 `./bin/`。

## 生成纯静态发行包

```powershell
npm run build        # 复制核心文件到 dist/
npm run package:zip  # 打包 dist/ 到 release/screen-note-<version>.zip
```

手动：

```powershell
if (-not (Test-Path release)) { New-Item -ItemType Directory -Path release | Out-Null }
Compress-Archive -Path 'dist\*' -DestinationPath "release\screen-note-0.1.0.zip" -Force
```

## 目录结构速览

| 路径 | 说明 |
| ---- | ---- |
| `src/core` | Canvas 管理、工具、事件总线、历史 |
| `src/ui` | 浮动按钮、面板、样式（`sn-` 前缀） |
| `win32/` | 原生透明宿主 (CMake + WebView2) |
| `scripts/` | 打包 / 构建辅助脚本 |
| `src-tauri/` | 旧 Tauri 实验（存档） |
| `neutralino.config.json` | Neutralino 配置 |

## 后续计划 / TODO

- [ ] 移除 `src/main/index.js` 中 Neutralino / Tauri 回退逻辑
- [ ] 原生层改为严格 JSON 解析（当前基于简单字符串匹配）
- [ ] 增加最小自动化测试（历史撤销、笔迹采样平滑）
- [ ] 文档中加入架构图示意

## License

MIT
