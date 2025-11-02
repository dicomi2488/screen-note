# Screen Note

一个基于 Web + Tauri 2.x 的全屏浮层画板。

网页版DEMO：https://screen-note.netlify.app/

## 特性：

- 画笔 / 橡皮擦 / 指针等工具
- 撤销 / 重做（矢量 stroke 历史）
- 高 DPI 适配（自动按设备像素比缩放）
- 透明背景 + 鼠标穿透（Windows API 实现的区域级鼠标穿透）

## 使用说明

1. **主按钮**: 点击展开工具菜单，可拖动到屏幕边缘自动吸附
2. **光标模式**: 启用透传，鼠标可穿透应用点击下层窗口
3. **画笔工具**: 选择后禁用透传，可在屏幕上绘图
4. **撤销**: 撤销上一次绘制操作
5. **橡皮擦**: 擦除已绘制的内容
6. **设置**: 调整弹出方向等，关闭后自动切换到光标模式

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

## 后续计划 / TODO

- [x] 打包项目软件，框架可能用Tauri,但是鼠标透传好像比较难实现(2025/11/3)
- [ ] 自定义快捷键
- [ ] 自定义默认颜色
- [ ] 橡皮：圈选擦除
- [ ] 开发插件功能，防止臃肿
- [ ] (插件)添加自定义按钮，可启动其它应用
- [ ] (插件)荧光笔等其它笔

## License

MIT
