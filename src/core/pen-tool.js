// 简单笔工具：监听 pointer 事件并把点提交给 CanvasManager
export default class PenTool {
	constructor({ canvasManager, history, bus } = {}) {
		this.canvasManager = canvasManager;
		this.history = history;
		this.bus = bus;
		this._color = '#000000';
		this._width = 4;
		this._onPointerDown = this._onPointerDown.bind(this);
		this._onPointerMove = this._onPointerMove.bind(this);
		this._onPointerUp = this._onPointerUp.bind(this);
		this._enabled = false;
		this._attach();
		// listen for color changes from UI
		if (this.bus && this.bus.on) {
			this.bus.on('tool:color', ({ color } = {}) => {
				if (color) this.setColor(color);
			});
			this.bus.on('tool:penWidth', ({ width } = {}) => {
				if (typeof width === 'number') this.setWidth(width);
			});
		}
	}

	_attach() {
		// 将事件绑定到 overlay canvas，便于捕获全屏绘制
		const el = this.canvasManager.canvas;
		el.addEventListener('pointerdown', this._onPointerDown);
		// 使用 capture 以便优先处理
		el.addEventListener('pointermove', this._onPointerMove);
		el.addEventListener('pointerup', this._onPointerUp);
		el.addEventListener('pointercancel', this._onPointerUp);
		// 全局监听以防 pointerup 在其它元素上触发（例如浮动按钮），确保能终止笔划
		window.addEventListener('pointerup', this._onPointerUp);
		window.addEventListener('pointercancel', this._onPointerUp);
	}

	enable() { this._enabled = true; }
	disable() { this._enabled = false; }

	_onPointerDown(e) {
		if (!this._enabled) return;
		e.preventDefault();
		// 捕获 pointer，以便当指针移动到其他元素（如工具按钮）上方时仍然接收后续的 pointermove/pointerup
		try {
			this.canvasManager.canvas.setPointerCapture && this.canvasManager.canvas.setPointerCapture(e.pointerId);
			this._pointerId = e.pointerId;
		} catch (err) {
			// 某些浏览器或环境可能抛出异常，忽略但保留 _pointerId
			this._pointerId = e.pointerId;
		}
		const rect = this.canvasManager.canvas.getBoundingClientRect();
		const id = this.canvasManager.startStroke({ tool: 'pen', color: this._color, width: this._width });
		this._current = { id };
		this._pushPoint(e, rect);
	}

	setColor(color) {
		// basic validation
		if (!color) return;
		this._color = color;
		// optionally, if you want immediate visual feedback on canvas UI, emit an event
		// this.bus && this.bus.emit('pen:color:changed', { color });
	}

	setWidth(width) {
		if (typeof width !== 'number' || Number.isNaN(width)) return;
		const clamped = Math.max(1, Math.min(width, 32));
		this._width = clamped;
	}

	_onPointerMove(e) {
		if (!this._enabled || !this._current) return;
		const rect = this.canvasManager.canvas.getBoundingClientRect();
		this._pushPoint(e, rect);
	}

	_onPointerUp(e) {
		if (!this._enabled || !this._current) return;
		// 只在匹配的 pointerId 或未记录 pointerId 时处理（兼容触控/鼠标）
		if (this._pointerId && e.pointerId && e.pointerId !== this._pointerId) return;
		const id = this._current.id;
		const stroke = this.canvasManager.endStroke(id);
		if (stroke && this.history) this.history.pushStroke(stroke);
		this._current = null;
		// 释放 pointer capture
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
