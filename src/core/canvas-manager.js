// 管理覆盖层 canvas 的创建、DPR 调整和基础绘制 API
export default class CanvasManager {
	constructor({ bus } = {}) {
		this.bus = bus;
		this._createCanvas();
		this._strokes = new Map();
		this._attachBus();
	}

	_createCanvas() {
		this.canvas = document.createElement('canvas');
		this.canvas.className = 'sn-canvas-overlay';
		this.ctx = this.canvas.getContext('2d', { alpha: true });
		this.canvas.style.position = 'fixed';
		this.canvas.style.left = '0';
		this.canvas.style.top = '0';
		this.canvas.style.pointerEvents = 'auto';
		this.canvas.style.zIndex = 999999;
		document.body.appendChild(this.canvas);
		this._onResize = this._onResize.bind(this);
		window.addEventListener('resize', this._onResize);
		this._onResize();
	}

	_onResize() {
		const dpr = window.devicePixelRatio || 1;
		this.dpr = dpr;
		const w = window.innerWidth;
		const h = window.innerHeight;
		this.canvas.width = Math.round(w * dpr);
		this.canvas.height = Math.round(h * dpr);
		this.canvas.style.width = w + 'px';
		this.canvas.style.height = h + 'px';
		this.ctx.scale(dpr, dpr);
		// redraw not implemented (tools render live)
	}

	startStroke(meta = {}) {
		const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
		const stroke = Object.assign({ id, points: [] }, meta);
		this._strokes.set(id, stroke);
		return id;
	}

	updateStroke(id, point) {
		const s = this._strokes.get(id);
		if (!s) return;
		s.points.push(point);
		// 渲染当前笔划（简单折线平滑）
		this._drawLiveStroke(s);
	}

	endStroke(id) {
		const s = this._strokes.get(id);
		if (!s) return null;
		// 最终渲染为一条路径
		this._drawFinalStroke(s);
		this._strokes.delete(id);
		if (this.bus) this.bus.emit('canvas:stroke:finished', { stroke: s });
		return s;
	}

	clear() {
		this.ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
		this._strokes.clear();
	}

	_attachBus() {
		if (!this.bus || !this.bus.on) return;
		this.bus.on('canvas:clear', () => {
			this.clear();
			if (this.bus && this.bus.emit) {
				this.bus.emit('canvas:cleared');
			}
		});
	}

	_drawLiveStroke(s) {
		// 简化：只把最新两点连线
		const pts = s.points;
		if (pts.length < 2) return;
		const a = pts[pts.length - 2];
		const b = pts[pts.length - 1];
		this.ctx.save();
		this._applyStyle(s);
		this.ctx.beginPath();
		this.ctx.moveTo(a.x, a.y);
		this.ctx.lineTo(b.x, b.y);
		this.ctx.stroke();
		this.ctx.restore();
	}

	_drawFinalStroke(s) {
		// 为了简单起见，直接重绘所有点为连续线
		if (!s.points || s.points.length === 0) return;
		this.ctx.save();
		this._applyStyle(s);
		this.ctx.beginPath();
		this.ctx.moveTo(s.points[0].x, s.points[0].y);
		for (let i = 1; i < s.points.length; i++) {
			const p = s.points[i];
			this.ctx.lineTo(p.x, p.y);
		}
		this.ctx.stroke();
		this.ctx.restore();
	}

	_applyStyle(s) {
		this.ctx.lineCap = 'round';
		this.ctx.lineJoin = 'round';
		this.ctx.lineWidth = s.width || 4;
		this.ctx.strokeStyle = s.color || '#ff0';
		if (s.composite) this.ctx.globalCompositeOperation = s.composite;
		else this.ctx.globalCompositeOperation = 'source-over';
	}

	exportImage() {
		return this.canvas.toDataURL();
	}

		// 重绘一组矢量 stroke（按顺序）
		renderStrokes(strokes = []) {
			// 清空并按顺序绘制
			this.clear();
			for (const entry of strokes) {
				if (!entry || !entry.data) continue;
				const s = entry.data;
				// reuse internal draw logic
				this._drawFinalStroke(s);
			}
		}

		setPointerEvents(value = 'auto') {
			this.canvas.style.pointerEvents = value;
		}
}
