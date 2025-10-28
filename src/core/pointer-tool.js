// Pointer tool: toggles canvas pointer-events so the page below can receive events
export default class PointerTool {
  constructor({ canvasManager, bus } = {}) {
    this.canvasManager = canvasManager;
    this.bus = bus;
    this._enabled = false;
  }

  enable() {
    this._enabled = true;
    if (this.canvasManager && this.canvasManager.setPointerEvents) {
      this.canvasManager.setPointerEvents('none');
    }
  }

  disable() {
    this._enabled = false;
    if (this.canvasManager && this.canvasManager.setPointerEvents) {
      this.canvasManager.setPointerEvents('auto');
    }
  }
}
