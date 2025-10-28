// 简易历史管理：保存矢量 stroke，支持 undo/redo
export default class HistoryManager {
	constructor({ bus } = {}) {
		this.bus = bus;
		this.past = [];
		this.future = [];
		this._attachBus();
	}

	pushStroke(stroke) {
		this.past.push({ type: 'stroke', data: stroke });
		this.future.length = 0;
		if (this.bus) this.bus.emit('history:changed', { past: this.past.length });
	}

	undo() {
		if (this.past.length === 0) return null;
		const entry = this.past.pop();
		this.future.push(entry);
		if (this.bus) this.bus.emit('history:undo', entry);
		return entry;
	}

	redo() {
		if (this.future.length === 0) return null;
		const entry = this.future.pop();
		this.past.push(entry);
		if (this.bus) this.bus.emit('history:redo', entry);
		return entry;
	}

	clear() {
		const hadHistory = this.past.length > 0 || this.future.length > 0;
		this.past.length = 0;
		this.future.length = 0;
		if (!this.bus || !hadHistory) return;
		this.bus.emit('history:cleared');
		this.bus.emit('history:changed', { past: 0, future: 0 });
	}

	_attachBus() {
		if (!this.bus || !this.bus.on) return;
		this.bus.on('canvas:clear', () => {
			this.clear();
		});
	}
}
