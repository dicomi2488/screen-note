// Pointer tool: enables mouse passthrough with region-based control
export default class PointerTool {
  constructor({ canvasManager, bus } = {}) {
    this.canvasManager = canvasManager;
    this.bus = bus;
    this._enabled = false;
  }

  async enable() {
    this._enabled = true;
    
    // 设置 canvas 不接收事件（样式层面）
    if (this.canvasManager && this.canvasManager.setPointerEvents) {
      this.canvasManager.setPointerEvents('none');
    }
    
    console.log('[PointerTool] 已启用');
  }

  async disable() {
    this._enabled = false;
    
    // 恢复 canvas 接收事件
    if (this.canvasManager && this.canvasManager.setPointerEvents) {
      this.canvasManager.setPointerEvents('auto');
    }
    
    console.log('[PointerTool] 已禁用');
  }
}

