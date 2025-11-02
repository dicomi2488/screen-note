# Screen Note

一个基于纯 Web 的全屏浮层画板（overlay canvas + 浮动工具球）。特性：

- 画笔 / 橡皮擦 / 指针工具
- 撤销 / 重做（矢量 stroke 历史）
- 高 DPI 适配（自动按设备像素比缩放）
- 透明背景 + 鼠标穿透（Win32 + WebView2 原生实现）

# Screen Note

一个基于 Tauri 2.x 的全屏透明画板应用，支持精确的鼠标选择性透传。

## 核心特性

- 🎨 **绘图工具**: 画笔、橡皮擦、指针（光标模式）
- ↩️ **历史管理**: 撤销/重做（基于矢量 stroke）
- 🖱️ **智能透传**: Windows API 实现的区域级鼠标穿透
  - 独立圆形容器架构，每个按钮独立定位
  - CreateEllipticRgn 实现圆形可交互区域
  - 动画过程实时追踪（600ms RAF）
  - 拖动时零延迟响应
- 🎯 **高 DPI 适配**: 自动按设备像素比缩放
- 🌐 **全屏透明**: 完全透明背景，悬浮在所有窗口之上

## 技术架构

- **前端**: 纯 JavaScript (ES modules)
  - 事件总线模式解耦模块
  - 独立圆形容器 UI 架构
  - 实时 RAF 追踪系统
- **后端**: Tauri 2.9.1 + Rust
  - Windows API (windows-rs 0.52)
  - 自定义命令: `set_interactive_regions`, `clear_interactive_regions`
  - 区域级透传控制

## 快速开始

### 前置要求

- Node.js 16+
- Rust 1.70+ (通过 rustup 安装)
- Windows 10/11

### 安装依赖

```powershell
npm install
```

### 开发模式

```powershell
npx tauri dev
```

### 构建发布版

```powershell
npx tauri build
```

输出位置: `src-tauri/target/release/bundle/`

## 使用说明

1. **主按钮**: 点击展开工具菜单，可拖动到屏幕边缘自动吸附
2. **画笔工具**: 选择后禁用透传，可在屏幕上绘图
3. **橡皮擦**: 擦除已绘制的内容
4. **光标模式**: 启用透传，鼠标可穿透应用点击下层窗口
5. **撤销**: 撤销上一次绘制操作
6. **设置**: 调整弹出方向等，关闭后自动切换到光标模式

## 项目结构

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

## 项目结构

```
screen-note/
├── src/
│   ├── core/           # 核心逻辑
│   │   ├── canvas-manager.js      # Canvas 管理与绘制
│   │   ├── event-bus.js           # 事件总线
│   │   ├── history-manager.js     # 撤销/重做
│   │   ├── pen-tool.js            # 画笔工具
│   │   ├── eraser-tool.js         # 橡皮擦工具
│   │   ├── pointer-tool.js        # 光标模式
│   │   └── stroke-index.js        # 笔迹索引
│   ├── ui/             # UI 组件
│   │   ├── floating-button.js     # 浮动工具球（独立圆形容器）
│   │   ├── pen-panel.js           # 画笔设置面板
│   │   ├── eraser-panel.js        # 橡皮擦设置面板
│   │   ├── settings-modal.js      # 设置对话框
│   │   └── styles.css             # 样式（sn-前缀）
│   ├── utils/          # 工具函数
│   │   ├── pointer-smoother.js    # 指针平滑
│   │   └── positioning.js         # 定位辅助
│   └── icons/          # SVG 图标
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                # Tauri 主入口
│   │   ├── lib.rs                 # 库定义
│   │   └── mouse_passthrough.rs   # Windows API 透传实现
│   ├── Cargo.toml                 # Rust 依赖
│   └── tauri.conf.json            # Tauri 配置
├── index.html          # 主页面
└── package.json        # Node.js 配置
```

## 核心实现细节

### 独立圆形容器架构

每个工具按钮都是独立的 fixed 定位容器：
- 主按钮: 56x56px 圆形
- 工具按钮: 44x44px 圆形
- `pointer-events: auto` 在按钮上，`none` 在空白处

### 圆形可视化框架

使用 Windows API `CreateEllipticRgn` 创建椭圆形区域：
- 区域比按钮大 2px (每边扩展 1px)
- 实时追踪动画过程（600ms RAF）
- 拖动时即时更新（无 transition 延迟）

### 事件驱动架构

所有模块通过事件总线通信：
- `tool:select` - 工具切换
- `ui:floating:toggle` - 工具菜单展开/收起
- `ui:floating:moved` - 浮动按钮移动
- `settings:closed` - 设置关闭（自动切换到光标模式）

## 开发指南

详见 [`.github/copilot-instructions.md`](.github/copilot-instructions.md)

## License

MIT
