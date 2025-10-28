import EventBus from '../core/event-bus.js';
import CanvasManager from '../core/canvas-manager.js';
import PenTool from '../core/pen-tool.js';
import EraserTool from '../core/eraser-tool.js';
import SelectTool from '../core/select-tool.js';
import HistoryManager from '../core/history-manager.js';
import StrokeIndex from '../core/stroke-index.js'; // 保留但全透传模式下暂不使用
import FloatingButton from '../ui/floating-button.js';
import SettingsModal from '../ui/settings-modal.js';

// 初始化全局单例
const bus = new EventBus();
const canvasManager = new CanvasManager({ bus });
const history = new HistoryManager({ bus });
const strokeIndex = new StrokeIndex({ bus, history }); // 预留：将来可退出全透传再启用

// 初始化工具与 UI
const pen = new PenTool({ canvasManager, history, bus });
const eraser = new EraserTool({ canvasManager, history, bus });
const select = new SelectTool({ canvasManager, bus });
const settings = new SettingsModal({ bus });
const floating = new FloatingButton({ bus });
console.log('[screen-note] floating button created', !!floating?.root);

// 压制扩展注入报错
function suppressExtError(ev) {
  try {
    const msg = ev?.message || '';
    if (typeof msg === 'string' && msg.includes('Could not establish connection. Receiving end does not exist')) {
      console.debug('[suppressed extension error]', msg);
      ev.preventDefault();
    }
  } catch (_) {}
}
window.addEventListener('error', suppressExtError);
window.addEventListener('unhandledrejection', (ev) => {
  try {
    const reason = ev?.reason;
    const text = typeof reason === 'string' ? reason : (reason && reason.message) ? reason.message : '';
    if (typeof text === 'string' && text.includes('Could not establish connection. Receiving end does not exist')) {
      console.debug('[suppressed extension rejection]', text);
      ev.preventDefault();
    }
  } catch (_) {}
});

let currentTool = 'select';
// 透传模式移除后不再需要 toolbarPressActive
function recordCurrentTool(name) {
  currentTool = name || 'select';
  window.__screenNote = window.__screenNote || {};
  window.__screenNote.currentTool = currentTool;
}


// 默认启用选择工具
recordCurrentTool('select');
select.enable();
pen.disable();
eraser.disable();

function disableAllTools() { select.disable(); pen.disable(); eraser.disable(); }
function enableTool(name) {
  disableAllTools();
  recordCurrentTool(name);
  if (name === 'select') {
    select.enable();
  } else if (name === 'pen') {
    pen.enable();
  } else if (name === 'eraser') {
    eraser.enable();
  }
}


// 工具选择事件
bus.on('tool:select', ({ tool } = {}) => {
  if (!tool) return;
  if (tool === 'undo') { history.undo(); canvasManager.renderStrokes(history.past); return; }
  if (tool === 'settings') { settings.show(); return; }
  if (tool === 'select' || tool === 'pen' || tool === 'eraser') enableTool(tool);
});


window.__screenNote = Object.assign(window.__screenNote || {}, {
  bus,
  canvasManager,
  history,
  strokeIndex,
  select,
  pen,
  eraser,
  floating,
  settings,
});
