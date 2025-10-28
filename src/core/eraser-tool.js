// 简单橡皮工具：使用 composite 'destination-out' 擦除
export default class EraserTool {
  constructor({ canvasManager, history, bus } = {}) {
    this.canvasManager = canvasManager;
    this.history = history;
    this.bus = bus;
    this._width = 24;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._enabled = false;
    this._attach();
    this._attachBus();
  }

  _attach() {
    const el = this.canvasManager.canvas;
    el.addEventListener('pointerdown', this._onPointerDown);
    el.addEventListener('pointermove', this._onPointerMove);
    el.addEventListener('pointerup', this._onPointerUp);
    el.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
  }

  enable() { this._enabled = true; }
  disable() { this._enabled = false; }

  _attachBus() {
    if (!this.bus || !this.bus.on) return;
    this.bus.on('tool:eraserWidth', ({ width } = {}) => {
      if (typeof width === 'number') this.setWidth(width);
    });
  }

  setWidth(width) {
    if (typeof width !== 'number' || Number.isNaN(width)) return;
    const clamped = Math.max(4, Math.min(width, 64));
    this._width = clamped;
  }

  _onPointerDown(e) {
    if (!this._enabled) return;
    e.preventDefault();
    const rect = this.canvasManager.canvas.getBoundingClientRect();
    try {
      this.canvasManager.canvas.setPointerCapture && this.canvasManager.canvas.setPointerCapture(e.pointerId);
      this._pointerId = e.pointerId;
    } catch (err) {
      this._pointerId = e.pointerId;
    }
    const id = this.canvasManager.startStroke({ tool: 'eraser', composite: 'destination-out', width: this._width });
    this._current = { id };
    this._pushPoint(e, rect);
  }

  _onPointerMove(e) {
    if (!this._enabled || !this._current) return;
    const rect = this.canvasManager.canvas.getBoundingClientRect();
    this._pushPoint(e, rect);
  }

  _onPointerUp(e) {
    if (!this._enabled || !this._current) return;
    if (this._pointerId && e.pointerId && e.pointerId !== this._pointerId) return;
    const id = this._current.id;
    const stroke = this.canvasManager.endStroke(id);
    if (stroke && this.history) this.history.pushStroke(stroke);
    this._current = null;
    try {
      if (this._pointerId) this.canvasManager.canvas.releasePointerCapture && this.canvasManager.canvas.releasePointerCapture(this._pointerId);
    } catch (err) {
      // ignore
    }
    this._pointerId = null;
  }

  _pushPoint(e, rect) {
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const t = Date.now();
    this.canvasManager.updateStroke(this._current.id, { x, y, t });
  }
}
