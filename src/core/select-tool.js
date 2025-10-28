// Select tool: 占位工具，用于未来的选区/对象操作。当前仅维护 enable/disable 状态。
export default class SelectTool {
  constructor({ bus, canvasManager } = {}) {
    this.bus = bus;
    this.canvasManager = canvasManager;
    this._enabled = false;
  }
  enable() { this._enabled = true; }
  disable() { this._enabled = false; }
  isEnabled() { return this._enabled; }
}
