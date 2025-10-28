// 简单的事件总线，用于模块间松耦合通信
export default class EventBus {
	constructor() {
		this.handlers = new Map();
	}

	on(event, fn) {
		if (!this.handlers.has(event)) this.handlers.set(event, new Set());
		this.handlers.get(event).add(fn);
		return () => this.off(event, fn);
	}

	off(event, fn) {
		const s = this.handlers.get(event);
		if (!s) return;
		s.delete(fn);
		if (s.size === 0) this.handlers.delete(event);
	}

	emit(event, payload) {
		const s = this.handlers.get(event);
		if (!s) return;
		// shallow copy to avoid mutation while iterating
		Array.from(s).forEach(fn => {
			try {
				fn(payload);
			} catch (e) {
				console.error('event handler error', event, e);
			}
		});
	}
}
