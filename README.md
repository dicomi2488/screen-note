# Screen Note

一个基于纯 Web 的全屏浮层画板（overlay canvas + 浮动工具球）。特性：

- 画笔 / 橡皮擦 / 指针工具
- 撤销 / 重做（矢量 stroke 历史）
- 高 DPI 适配（自动按设备像素比缩放）
- 透明背景 + 鼠标穿透（Win32 + WebView2 原生实现）

> 透明 & 鼠标穿透的“强控制”版本已通过 `win32/` 下原生宿主实现；Neutralino 版本仍保留（可运行），后续可能裁剪。

## 快速预览（纯浏览器）

目前只基于网页做了基础功能，还没打包

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

## 后续计划 / TODO

- [ ] 打包项目软件，框架可能用Tauri,但是鼠标透传好像比较难实现
- [ ] 原生层改为严格 JSON 解析（当前基于简单字符串匹配）
- [ ] 增加最小自动化测试（历史撤销、笔迹采样平滑）
- [ ] 文档中加入架构图示意

## License

GNU GPL
