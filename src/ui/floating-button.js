// 浮动按钮：独立圆形容器架构，完美透传

import PenPanel from './pen-panel.js';
import EraserPanel from './eraser-panel.js';

export default class FloatingButton {
	constructor({ bus, direction } = {}) {
		this.bus = bus;
		this._direction = direction || 'right';
		this._currentTool = null;
		this._toolElements = [];
		
		this._create();
		this.penPanel = new PenPanel({ bus: this.bus });
		this.eraserPanel = new EraserPanel({ bus: this.bus });
		
		if (this.bus && this.bus.on) {
			this.bus.on('ui:direction', ({ direction } = {}) => {
				if (direction) this.setDirection(direction);
			});
			
			this.bus.on('tool:color', ({ color } = {}) => {
				if (color && this._currentTool === 'pen') this._setColorIndicator(color);
			});

			this.bus.on('tool:select', ({ tool } = {}) => {
				this._currentTool = tool;
				this._updateIndicatorVisibility(tool);
				if (tool !== 'pen' && this.penPanel) this.penPanel.hide();
				if (tool !== 'eraser' && this.eraserPanel) this.eraserPanel.hide();
			});
		}
	}

	_setIndicatorVisible(visible) {
		const el = this.root && this.root.querySelector('.sn-color-indicator');
		if (!el) return;
		el.style.display = visible ? 'block' : 'none';
	}

	_updateIndicatorVisibility(tool) {
		const show = tool === 'pen';
		this._setIndicatorVisible(show);
		if (show) {
			const el = this.root && this.root.querySelector('.sn-color-indicator');
			if (el && !el.getAttribute('data-color')) {
				this._setColorIndicator('#000000');
			}
		}
	}

	_setColorIndicator(color) {
		try {
			if (!this.root) return;
			const el = this.root.querySelector('.sn-color-indicator');
			if (!el) return;
			el.style.background = color || 'transparent';
			el.setAttribute('data-color', color || '');
		} catch (err) {
			// ignore
		}
	}

	_create() {
		// 主按钮容器
		this.root = document.createElement('div');
		this.root.className = 'sn-floating';
		this.root.innerHTML = `
			<button class="sn-main-button" title="Screen Note">
				<img src="src/icons/main_icon.svg" alt="main" draggable="false" />
				<span class="sn-color-indicator" aria-hidden="true"></span>
			</button>
		`;
		document.body.appendChild(this.root);
		
		// 创建独立的工具按钮（每个都是独立的 fixed 元素，圆形容器）
		const tools = [
			{ tool: 'pointer', title: '指针 (透传)', icon: 'cursor.svg' },
			{ tool: 'pen', title: '画笔', icon: 'pen.svg' },
			{ tool: 'undo', title: '撤回', icon: 'withdraw.svg' },
			{ tool: 'eraser', title: '橡皮', icon: 'eraser.svg' },
			{ tool: 'settings', title: '设置', icon: 'setting.svg' }
		];
		
		tools.forEach(({ tool, title, icon }) => {
			const wrapper = document.createElement('div');
			wrapper.className = 'sn-tool-wrapper';
			wrapper.setAttribute('data-tool', tool);
			wrapper.innerHTML = `
				<button class="sn-tool" data-tool="${tool}" title="${title}">
					<img src="src/icons/${icon}" alt="${tool}" draggable="false" />
				</button>
			`;
			document.body.appendChild(wrapper);
			this._toolElements.push(wrapper);
		});
		
		this._wire();
		this._updateToolPositions();
	}

	_wire() {
		const main = this.root.querySelector('.sn-main-button');
		
		// 拖动逻辑
		let pointerDown = false;
		let startX = 0, startY = 0;
		let offsetX = 0, offsetY = 0;
		let moved = false;
		const threshold = 6;

		main.addEventListener('pointerdown', (e) => {
			console.log('[FloatingButton] pointerdown');
			pointerDown = true;
			moved = false;
			startX = e.clientX;
			startY = e.clientY;
			const rect = this.root.getBoundingClientRect();
			offsetX = startX - rect.left;
			offsetY = startY - rect.top;
			main.setPointerCapture && main.setPointerCapture(e.pointerId);
			main.classList.add('dragging');
			e.preventDefault();
			e.stopPropagation();
		});

		// 重要：绑定到 document 而非 window
		document.addEventListener('pointermove', (e) => {
			if (!pointerDown) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			if (!moved && Math.hypot(dx, dy) > threshold) {
				moved = true;
				console.log('[FloatingButton] 开始拖动');
			}
			if (moved) {
				const margin = 8;
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				const w = 56;
				const h = 56;
				let left = e.clientX - offsetX;
				let top = e.clientY - offsetY;
				left = Math.max(margin, Math.min(left, vw - w - margin));
				top = Math.max(margin, Math.min(top, vh - h - margin));
				this.root.style.left = left + 'px';
				this.root.style.top = top + 'px';
				this.root.style.right = 'auto';
				this.root.style.bottom = 'auto';
				this._updateToolPositions(false); // 拖动时不使用动画
				// 通知拖动事件
				if (this.bus) this.bus.emit('ui:floating:moved');
			}
		});

		main.addEventListener('pointerup', (e) => {
			console.log('[FloatingButton] pointerup, moved:', moved);
			pointerDown = false;
			main.releasePointerCapture && main.releasePointerCapture(e.pointerId);
			main.classList.remove('dragging');
			
			if (!moved) {
				// 点击：展开/收起
				const wasOpen = this.root.classList.contains('open');
				this.root.classList.toggle('open');
				main.classList.add('clicked');
				setTimeout(() => main.classList.remove('clicked'), 220);
				
				// 展开时使用动画，收起时不用
				const isNowOpen = this.root.classList.contains('open');
				this._updateToolPositions(isNowOpen && !wasOpen);
				
				console.log('[FloatingButton] 切换展开状态');
				// 通知展开/收起事件
				if (this.bus) this.bus.emit('ui:floating:toggle');
			} else {
				// 拖动结束：吸附到边缘
				this._snapToEdge();
				// 通知拖动结束
				if (this.bus) this.bus.emit('ui:floating:moved');
			}
			
			e.preventDefault();
			e.stopPropagation();
		});

		// 工具按钮点击
		this._toolElements.forEach(wrapper => {
			const btn = wrapper.querySelector('.sn-tool');
			btn.addEventListener('click', () => {
				const tool = btn.getAttribute('data-tool');
				this._onSelect(tool);
			});
			
			// 双击打开配置面板
			btn.addEventListener('dblclick', (e) => {
				e.preventDefault();
				e.stopPropagation();
				const tool = btn.getAttribute('data-tool');
				if (tool === 'pen' && this.penPanel) {
					if (this.eraserPanel) this.eraserPanel.hide();
					this.penPanel.toggle(btn, this._direction);
				} else if (tool === 'eraser' && this.eraserPanel) {
					if (this.penPanel) this.penPanel.hide();
					this.eraserPanel.toggle(btn, this._direction);
				}
			});
		});

		window.addEventListener('resize', () => {
			this._updateToolPositions();
		});
	}

	_onSelect(tool) {
		if (this.bus) this.bus.emit('tool:select', { tool });
	}

	_snapToEdge() {
		const snapThreshold = 80;
		const margin = 8;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const w = 56;
		const h = 56;
		
		const rect = this.root.getBoundingClientRect();
		const centerX = rect.left + w / 2;
		const centerY = rect.top + h / 2;
		
		let left = parseFloat(this.root.style.left) || rect.left;
		let top = parseFloat(this.root.style.top) || rect.top;
		
		const distLeft = centerX;
		const distRight = vw - centerX;
		const distTop = centerY;
		const distBottom = vh - centerY;
		
		// 横向吸附
		if (distRight <= snapThreshold) {
			left = vw - w - margin;
			this.setDirection('left');
		} else if (distLeft <= snapThreshold) {
			left = margin;
			this.setDirection('right');
		}
		
		// 纵向吸附
		if (distBottom <= snapThreshold && distBottom < Math.min(distLeft, distRight)) {
			top = vh - h - margin;
			this.setDirection('top');
		} else if (distTop <= snapThreshold && distTop < Math.min(distLeft, distRight)) {
			top = margin;
			this.setDirection('bottom');
		}
		
		this.root.style.left = left + 'px';
		this.root.style.top = top + 'px';
		this._updateToolPositions();
	}

	_updateToolPositions(animate = false) {
		const isOpen = this.root.classList.contains('open');
		
		const mainRect = this.root.getBoundingClientRect();
		const mainCenterX = mainRect.left + mainRect.width / 2;
		const mainCenterY = mainRect.top + mainRect.height / 2;
		const gap = 12; // 按钮间距
		const toolSize = 44;
		
		if (!isOpen) {
			// 收起：先移到主图标位置，然后隐藏
			this._toolElements.forEach(wrapper => {
				wrapper.style.left = (mainCenterX - toolSize / 2) + 'px';
				wrapper.style.top = (mainCenterY - toolSize / 2) + 'px';
				wrapper.style.opacity = '0';
				wrapper.style.transform = 'scale(0.3)';
				wrapper.style.pointerEvents = 'none';
			});
			return;
		}
		
		// 展开动画：从主图标位置快速渐出
		this._toolElements.forEach((wrapper, index) => {
			const distance = (index + 1) * (toolSize + gap);
			let finalX, finalY;
			
			switch (this._direction) {
				case 'right':
					finalX = mainCenterX + distance;
					finalY = mainCenterY;
					break;
				case 'left':
					finalX = mainCenterX - distance;
					finalY = mainCenterY;
					break;
				case 'bottom':
					finalX = mainCenterX;
					finalY = mainCenterY + distance;
					break;
				case 'top':
					finalX = mainCenterX;
					finalY = mainCenterY - distance;
					break;
			}
			
			if (animate) {
				// 第一步：立即设置到主图标位置（不可见）
				wrapper.style.transition = 'none';
				wrapper.style.left = (mainCenterX - toolSize / 2) + 'px';
				wrapper.style.top = (mainCenterY - toolSize / 2) + 'px';
				wrapper.style.opacity = '0';
				wrapper.style.transform = 'scale(0.3)';
				wrapper.style.pointerEvents = 'auto';
				
				// 强制重排
				wrapper.getBoundingClientRect();
				
				// 第二步：恢复过渡并移动到最终位置（延迟不同时间形成错开效果）
				const delay = index * 30; // 每个按钮延迟 30ms
				setTimeout(() => {
					wrapper.style.transition = 'all 280ms cubic-bezier(0.34, 1.56, 0.64, 1)'; // 弹性效果
					wrapper.style.left = (finalX - toolSize / 2) + 'px';
					wrapper.style.top = (finalY - toolSize / 2) + 'px';
					wrapper.style.opacity = '1';
					wrapper.style.transform = 'scale(1)';
				}, delay);
			} else {
				// 无动画：直接设置到最终位置（拖动时使用）
				wrapper.style.transition = 'none'; // 移除过渡，立即响应
				wrapper.style.left = (finalX - toolSize / 2) + 'px';
				wrapper.style.top = (finalY - toolSize / 2) + 'px';
				wrapper.style.opacity = '1';
				wrapper.style.transform = 'scale(1)';
				wrapper.style.pointerEvents = 'auto';
			}
		});
	}

	setDirection(direction) {
		if (this._direction === direction) return false;
		this._direction = direction;
		this.root.setAttribute('data-direction', direction);
		this._updateToolPositions();
		return true;
	}

	_refreshPanels(direction) {
		// 刷新面板位置（如果需要）
		if (this.penPanel) this.penPanel.hide();
		if (this.eraserPanel) this.eraserPanel.hide();
	}
}
