// 浮动按钮：一个圆球，点击展开多个工具小球（指针、画笔、撤回、橡皮、设置）

import PenPanel from './pen-panel.js';
import EraserPanel from './eraser-panel.js';

export default class FloatingButton {
	constructor({ bus, direction } = {}) {
		this.bus = bus;
		this._toolOrder = ['select', 'pen', 'undo', 'eraser', 'settings'];
		this._toolWrappers = [];
		this._activeToolAnimations = [];
		this._create();
		this.penPanel = new PenPanel({ bus: this.bus });
		this.eraserPanel = new EraserPanel({ bus: this.bus });
		this._direction = null;
		// set initial direction (right as default)
		this.setDirection(direction || 'right');
		// track current tool (null until user/tooling sets it)
		this._currentTool = null;
		// ensure indicator hidden by default
		this._setIndicatorVisible(false);
		// listen for direction change events
		if (this.bus && this.bus.on) {
			this.bus.on('ui:direction', ({ direction } = {}) => {
				if (direction) this.setDirection(direction);
			});
			// listen for color changes to update UI indicator (only show when pen is active)
			this.bus.on('tool:color', ({ color } = {}) => {
				if (color && this._currentTool === 'pen') this._setColorIndicator(color);
			});

			// listen for tool selection to toggle indicator visibility
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
		// if now showing and no color yet, set default
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
				this.root = document.createElement('div');
				this.root.className = 'sn-floating';
				// 调试：如果样式未生效或被覆盖，强制一个初始可见位置
				this.root.style.top = '40px';
				this.root.style.left = '40px';
				this.root.style.bottom = 'auto';
				this.root.style.right = 'auto';
				this.root.innerHTML = `
						<button class="sn-main-button" title="Screen Note">
								<img src="src/icons/main_icon.svg" alt="main" draggable="false" />
								<span class="sn-color-indicator" aria-hidden="true"></span>
						</button>
						<div class="sn-tools">
								<div class="sn-tool-wrapper" data-tool="select">
									<button class="sn-tool" data-tool="select" title="选择">
										<img src="src/icons/cursor.svg" alt="select" draggable="false" />
									</button>
								</div>
							<div class="sn-tool-wrapper" data-tool="pen">
								<button class="sn-tool" data-tool="pen" title="画笔">
									<img src="src/icons/pen.svg" alt="pen" draggable="false" />
								</button>
							</div>
							<div class="sn-tool-wrapper" data-tool="undo">
								<button class="sn-tool" data-tool="undo" title="撤回">
									<img src="src/icons/withdraw.svg" alt="undo" draggable="false" />
								</button>
							</div>
							<div class="sn-tool-wrapper" data-tool="eraser">
								<button class="sn-tool" data-tool="eraser" title="橡皮">
									<img src="src/icons/eraser.svg" alt="eraser" draggable="false" />
								</button>
							</div>
							<div class="sn-tool-wrapper" data-tool="settings">
								<button class="sn-tool" data-tool="settings" title="设置">
									<img src="src/icons/setting.svg" alt="settings" draggable="false" />
								</button>
							</div>
						</div>
					`;
		document.body.appendChild(this.root);
		this._wire();
	}

	_wire() {
			const main = this.root.querySelector('.sn-main-button');
			const tools = this.root.querySelector('.sn-tools');
			// click/drag handling: differentiate between click and drag
			let pointerDown = false;
			let startX = 0, startY = 0;
			let offsetX = 0, offsetY = 0;
			let moved = false;
			const threshold = 6; // px

			main.addEventListener('pointerdown', (e) => {
				pointerDown = true;
				moved = false;
				startX = e.clientX;
				startY = e.clientY;
				const rect = this.root.getBoundingClientRect();
				offsetX = startX - rect.left;
				offsetY = startY - rect.top;
				main.setPointerCapture && main.setPointerCapture(e.pointerId);
				main.classList.add('dragging');
			});

			window.addEventListener('pointermove', (e) => {
				if (!pointerDown) return;
				const dx = e.clientX - startX;
				const dy = e.clientY - startY;
				if (!moved && Math.hypot(dx, dy) > threshold) moved = true;
				if (moved) {
					// move the floating root
					// calculate clamped position so the root never leaves the viewport (8px margin)
					const margin = 8;
					const vw = window.innerWidth;
					const vh = window.innerHeight;

					// tools row rect - used to nudge palette if it overlaps the icons
					const w = this.root.offsetWidth || 56;
					const h = this.root.offsetHeight || 56;
					let left = e.clientX - offsetX;
					let top = e.clientY - offsetY;
					// clamp
					left = Math.max(margin, Math.min(left, vw - w - margin));
					top = Math.max(margin, Math.min(top, vh - h - margin));
					this.root.style.left = left + 'px';
					this.root.style.top = top + 'px';
					this.root.style.right = 'auto';
					this.root.style.bottom = 'auto';
				}
				const direction = this._direction || 'right';
				this._refreshPanels(direction);
			});

			main.addEventListener('pointerup', (e) => {
				pointerDown = false;
				main.releasePointerCapture && main.releasePointerCapture(e.pointerId);
				main.classList.remove('dragging');
				if (!moved) {
					// treat as click: before toggling open, ensure current direction will fit on screen
					this._adjustDirectionIfOverflow();
					const willOpen = !this.root.classList.contains('open');
					this.root.classList.toggle('open');
					main.classList.add('clicked');
					window.setTimeout(() => main.classList.remove('clicked'), 220);
					// if we're opening, prepare ordering and animate icons outward from center
					if (willOpen) {
						this._applyToolOrder();
						try { this._updateToolPositions(this._direction || 'right', { animate: true, fromCenter: true }); } catch (err) {}
					} else {
						// closing: animate back (normal update will handle positions)
						try { this._updateToolPositions(this._direction || 'right', { animate: true }); } catch (err) {}
						if (this.penPanel) this.penPanel.hide();
						if (this.eraserPanel) this.eraserPanel.hide();
					}
				} else {
					// if moved, consider snapping to nearest screen edge and adjust popup direction accordingly
					const margin = 8;
					const snapThreshold = 20; // px
					const vw = window.innerWidth;
					const vh = window.innerHeight;
					const w = this.root.offsetWidth || 56;
					const h = this.root.offsetHeight || 56;
					let left = parseFloat(this.root.style.left) || this.root.getBoundingClientRect().left;
					let top = parseFloat(this.root.style.top) || this.root.getBoundingClientRect().top;

					// distances to edges
					const distLeft = left - margin;
					const distRight = vw - (left + w) - margin;
					const distTop = top - margin;
					const distBottom = vh - (top + h) - margin;
					let directionChanged = false;

					// snap horizontally if near edges
					if (distRight >= 0 && distRight <= snapThreshold) {
						// snap to right edge
						left = vw - w - margin;
						directionChanged = this.setDirection('left') || directionChanged;
					} else if (distLeft >= 0 && distLeft <= snapThreshold) {
						// snap to left edge
						left = margin;
						directionChanged = this.setDirection('right') || directionChanged;
					}

					// snap vertically if near edges (vertical snapping wins only if closer than horizontal)
					if (distBottom >= 0 && distBottom <= snapThreshold && distBottom < Math.min(distLeft, distRight)) {
						top = vh - h - margin;
						directionChanged = this.setDirection('top') || directionChanged;
					} else if (distTop >= 0 && distTop <= snapThreshold && distTop < Math.min(distLeft, distRight)) {
						top = margin;
						directionChanged = this.setDirection('bottom') || directionChanged;
					}

					// apply snapped position
					this.root.style.left = left + 'px';
					this.root.style.top = top + 'px';

					// after moving, ensure the current direction will fit; if not, flip
					directionChanged = this._adjustDirectionIfOverflow() || directionChanged;
					if (!directionChanged) {
						try { this._updateToolPositions(this._direction || 'right', { animate: false }); } catch (err) {}
					}
					if (this.penPanel) this.penPanel.hide();
					if (this.eraserPanel) this.eraserPanel.hide();
				}
			});

			window.addEventListener('resize', () => {
				try {
					this._updateToolPositions(this._direction || 'right', { animate: false });
				} catch (err) {}
			});

			// helper: if opening in current direction would place tools off-screen,
			// try flipping to opposite direction so tools stay visible.
			// This preserves snapping behaviour (snapping still sets direction on drag end).
			this._adjustDirectionIfOverflow = () => {
				let changed = false;
				try {
					const margin = 8; // match CSS margin and spacing
					const gap = 8; // .sn-tools gap and the '8px' offset in CSS
					const rootRect = this.root.getBoundingClientRect();
					const vw = window.innerWidth;
					const vh = window.innerHeight;
					const tools = Array.from(this.root.querySelectorAll('.sn-tool'));
					if (!tools.length) return;
					const toolW = tools[0].offsetWidth || 44;
					const toolH = tools[0].offsetHeight || 44;
					const count = tools.length;
					const totalW = count * toolW + Math.max(0, count - 1) * gap;
					const totalH = count * toolH + Math.max(0, count - 1) * gap;
					const dir = this.root.getAttribute('data-direction') || 'bottom';
					// helper to test if a given direction will overflow
					const willOverflow = (d) => {
						switch (d) {
							case 'right': {
								const neededRight = rootRect.right + gap + totalW;
								return neededRight > (vw - margin);
							}
							case 'left': {
								const neededLeft = rootRect.left - gap - totalW;
								return neededLeft < margin;
							}
							case 'bottom': {
								const neededBottom = rootRect.bottom + gap + totalH;
								return neededBottom > (vh - margin);
							}
							case 'top': {
								const neededTop = rootRect.top - gap - totalH;
								return neededTop < margin;
							}
						}
						return false;
					};
					// if current direction overflows, try opposite; if opposite fits, switch
					if (willOverflow(dir)) {
						let opposite = dir;
						switch (dir) {
							case 'left': opposite = 'right'; break;
							case 'right': opposite = 'left'; break;
							case 'top': opposite = 'bottom'; break;
							case 'bottom': opposite = 'top'; break;
						}
						if (!willOverflow(opposite)) {
							changed = this.setDirection(opposite) || changed;
						}
					}
				} catch (err) {
					// defensive: do nothing on layout/read failures
					console.warn('adjustDirectionIfOverflow failed', err);
				}
				return changed;
			};
		tools.addEventListener('click', (e) => {
			const btn = e.target.closest('.sn-tool');
			if (!btn) return;
			const tool = btn.getAttribute('data-tool');
			this._onSelect(tool);
		});

		// double-click pen/eraser to open configuration panels
		tools.addEventListener('dblclick', (e) => {
			const btn = e.target.closest('.sn-tool');
			if (!btn) return;
			const tool = btn.getAttribute('data-tool');
			if (tool !== 'pen' && tool !== 'eraser') return;
			e.preventDefault();
			e.stopPropagation();
			const direction = this._direction || 'right';
			if (tool === 'pen') {
				if (this.eraserPanel) this.eraserPanel.hide();
				if (this.penPanel) this.penPanel.toggle(btn, direction);
			} else if (tool === 'eraser') {
				if (this.penPanel) this.penPanel.hide();
				if (this.eraserPanel) this.eraserPanel.toggle(btn, direction);
			}
		});

		// ensure any open palettes are closed when floating root is removed
		this._removePalettes = () => {
			if (this.penPanel) this.penPanel.hide();
			if (this.eraserPanel) this.eraserPanel.hide();
		};
	}


	_onSelect(tool) {
		// 发送事件，业务模块决定如何处理
		if (this.bus) this.bus.emit('tool:select', { tool });
	}

	// Ensure the visual order of tools places pointer closest to main button and settings furthest.
	// Uses CSS `order` so DOM stays stable; also sets transition-delay so stagger matches visual order.
	_applyToolOrder() {
		const wrappers = this._toolOrder.map((tool) => this.root.querySelector(`.sn-tool-wrapper[data-tool="${tool}"]`)).filter(Boolean);
		if (!wrappers.length) return;
		this._toolWrappers = wrappers;
		wrappers.forEach((wrapper, idx) => {
			const delayMs = 40 * (idx + 1);
			wrapper.style.transitionDelay = delayMs + 'ms';
			const btn = wrapper.querySelector('.sn-tool');
			if (btn) {
				btn.style.transitionDelay = delayMs + 'ms';
			}
		});
	}

	_updateToolPositions(direction, { animate = true, fromCenter = false, mode = 'default', previousDirection = null } = {}) {
		if (!this._toolWrappers || !this._toolWrappers.length) return;
		const angleMap = { right: 0, bottom: 90, left: 180, top: -90 };
		const angle = angleMap[direction] ?? 0;
		const prevAngle = previousDirection ? (angleMap[previousDirection] ?? angle) : angle;
		const mainBtn = this.root.querySelector('.sn-main-button');
		const sampleWrapper = this._toolWrappers[0];
		const sampleBtn = sampleWrapper ? sampleWrapper.querySelector('.sn-tool') : null;
		const mainRadius = (mainBtn ? mainBtn.offsetWidth : 56) / 2;
		const toolSize = sampleBtn ? sampleBtn.offsetWidth : 44;
		const gap = 8;
		const baseRadius = mainRadius + gap + toolSize / 2;
		const step = toolSize + gap;
		const isOpen = this.root && this.root.classList && this.root.classList.contains('open');
		const isOpposite = this._isOppositeDirection(previousDirection, direction);
		if (mode === 'flip' && isOpposite && animate && isOpen) {
			this._runStraightFlip180({ wrappers: this._toolWrappers, baseRadius, step, prevAngle, newAngle: angle });
			return;
		}
		if (mode === 'default' && animate && isOpen && previousDirection && previousDirection !== direction && !isOpposite && this._isQuarterTurn(previousDirection, direction)) {
			this._runQuarterOrbit({ wrappers: this._toolWrappers, baseRadius, step, prevAngle, newAngle: angle });
			return;
		}
		this._toolWrappers.forEach((wrapper, idx) => {
			if (!wrapper) return;
			const radius = baseRadius + idx * step;
			const btn = wrapper.querySelector('.sn-tool');
			const applyTransforms = (r) => {
				wrapper.style.transform = `rotate(${angle}deg) translate(${r}px, 0)`;
				if (btn) {
					btn.style.setProperty('--sn-tool-rotation', `${-angle}deg`);
					btn.style.removeProperty('--sn-tool-scale');
					btn.style.zIndex = '';
					btn.style.opacity = '';
				}
			};
			// If we're opening from center, start at translate(0) with no transition,
			// then reflow and animate to the final radius so tools appear to grow outwards.
			if (fromCenter) {
				// save current transitions
				const prevWrapperTransition = wrapper.style.transition;
				const prevBtnTransition = btn ? btn.style.transition : '';
				// put wrapper at center without transform transition but preserve opacity transition
				wrapper.style.transition = 'opacity 180ms ease-in-out';
				applyTransforms(0);
				if (btn) {
					btn.style.transition = 'none';
					btn.style.setProperty('--sn-tool-rotation', `${-angle}deg`);
					btn.style.removeProperty('--sn-tool-scale');
					btn.style.zIndex = '';
					btn.style.opacity = '';
				}
				// ensure styles applied
				wrapper.getBoundingClientRect();
				// restore transitions then apply final transform
				wrapper.style.transition = prevWrapperTransition || 'transform 420ms cubic-bezier(.2,.9,.2,1), opacity 180ms ease-in-out';
				if (btn) btn.style.transition = prevBtnTransition || 'transform 220ms cubic-bezier(.2,.9,.2,1), opacity 180ms ease-in-out';
				// force a tiny delay so browser applies the 'from' state
				window.requestAnimationFrame(() => {
					applyTransforms(radius);
					if (btn) btn.style.setProperty('--sn-tool-rotation', `${-angle}deg`);
				});
				wrapper.dataset.orbitInit = '1';
				return;
			}
			if (!animate || !wrapper.dataset.orbitInit) {
				// first-time placement without animation
				const prevWrapperTransition = wrapper.style.transition;
				wrapper.style.transition = 'none';
				if (btn) {
					const prevBtnTransition = btn.style.transition;
					btn.style.transition = 'none';
					applyTransforms(radius);
					btn.getBoundingClientRect();
					btn.style.transition = prevBtnTransition;
				} else {
					applyTransforms(radius);
				}
				wrapper.getBoundingClientRect();
				wrapper.style.transition = prevWrapperTransition;
				wrapper.dataset.orbitInit = '1';
			} else {
				applyTransforms(radius);
			}
		});
	}

	_cancelActiveToolAnimations() {
		if (!this._activeToolAnimations || !this._activeToolAnimations.length) {
			this._activeToolAnimations = [];
			return;
		}
		this._activeToolAnimations.forEach((entry) => {
			if (!entry) return;
			if (entry.type === 'timeout' && entry.id) window.clearTimeout(entry.id);
			if (entry.type === 'frame' && entry.id) window.cancelAnimationFrame(entry.id);
			if (entry.type === 'animation' && entry.animation) {
				try { entry.animation.cancel(); } catch (err) {}
			}
			if (entry.type === 'cleanup' && typeof entry.fn === 'function') {
				try { entry.fn(); } catch (err) {}
			}
		});
		this._activeToolAnimations = [];
	}

	_refreshPanels(direction) {
		if (this.penPanel && this.penPanel.isOpen()) {
			this.penPanel.refresh(direction);
		}
		if (this.eraserPanel && this.eraserPanel.isOpen()) {
			this.eraserPanel.refresh(direction);
		}
	}

	_runStraightFlip180({ wrappers, baseRadius, step, prevAngle, newAngle }) {
		this._cancelActiveToolAnimations();
		if (!wrappers || !wrappers.length) return;
		const duration = 420;
		const easeIn = 'cubic-bezier(.55,.05,.85,.4)';
		const easeOut = 'cubic-bezier(.19,.84,.37,1)';
		const shrinkScale = 0.55;
		const fadeOpacity = 0.25;
		wrappers.forEach((wrapper, idx) => {
			if (!wrapper) return;
			const radius = baseRadius + idx * step;
			const btn = wrapper.querySelector('.sn-tool');
			const start = this._polarToCartesian(prevAngle, radius);
			const end = this._polarToCartesian(newAngle, radius);
			const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
			let finalized = false;
			wrapper.dataset.orbitInit = '1';
			wrapper.style.transition = 'none';
			wrapper.style.transform = `translate(${start.x}px, ${start.y}px)`;
			if (btn) {
				btn.style.transition = 'none';
				btn.style.setProperty('--sn-tool-rotation', '0deg');
				btn.style.removeProperty('--sn-tool-scale');
				btn.style.opacity = '1';
				btn.style.zIndex = '1000001';
			}
			wrapper.getBoundingClientRect();
			const wrapperAnimation = wrapper.animate([
				{ transform: `translate(${start.x}px, ${start.y}px)`, offset: 0, easing: easeIn },
				{ transform: `translate(${mid.x}px, ${mid.y}px)`, offset: 0.5, easing: easeOut },
				{ transform: `translate(${end.x}px, ${end.y}px)`, offset: 1 }
			], {
				duration,
				fill: 'none'
			});
			let btnAnimation = null;
			if (btn) {
				btnAnimation = btn.animate([
					{ transform: `translate(-50%, -50%) rotate(0deg) scale(1)`, opacity: 1, offset: 0, easing: easeIn },
					{ transform: `translate(-50%, -50%) rotate(0deg) scale(${shrinkScale})`, opacity: fadeOpacity, offset: 0.5, easing: easeOut },
					{ transform: `translate(-50%, -50%) rotate(0deg) scale(1)`, opacity: 1, offset: 1 }
				], {
					duration,
					fill: 'none'
				});
			}
			const finalize = () => {
				if (finalized) return;
				finalized = true;
				const prevWrapperTransition = wrapper.style.transition;
				wrapper.style.transition = 'none';
				wrapper.style.transform = `rotate(${newAngle}deg) translate(${radius}px, 0)`;
				wrapper.getBoundingClientRect();
				wrapper.style.transition = prevWrapperTransition || '';
				if (btn) {
					const prevBtnTransition = btn.style.transition;
					btn.style.transition = 'none';
					btn.style.setProperty('--sn-tool-rotation', `${-newAngle}deg`);
					btn.style.removeProperty('--sn-tool-scale');
					btn.style.opacity = '';
					btn.style.zIndex = '';
					btn.getBoundingClientRect();
					btn.style.transition = prevBtnTransition || '';
				}
				this._activeToolAnimations = this._activeToolAnimations.filter((entry) => {
					if (!entry) return false;
					if (entry.type === 'animation' && (entry.animation === wrapperAnimation || entry.animation === btnAnimation)) return false;
					if (entry.type === 'cleanup' && entry.fn === finalize) return false;
					return true;
				});
			};
			if (wrapperAnimation) {
				wrapperAnimation.onfinish = finalize;
				wrapperAnimation.oncancel = finalize;
				this._activeToolAnimations.push({ type: 'animation', animation: wrapperAnimation });
			}
			if (btnAnimation) {
				const clearBtnTransition = () => {
					if (!btn) return;
					btn.style.transition = '';
				};
				btnAnimation.onfinish = clearBtnTransition;
				btnAnimation.oncancel = clearBtnTransition;
				this._activeToolAnimations.push({ type: 'animation', animation: btnAnimation });
			}
			this._activeToolAnimations.push({ type: 'cleanup', fn: finalize });
		});
	}

	_runQuarterOrbit({ wrappers, baseRadius, step, prevAngle, newAngle }) {
		this._cancelActiveToolAnimations();
		if (!wrappers || !wrappers.length) return;
		const duration = 420;
		const easing = 'cubic-bezier(.2,.9,.2,1)';
		wrappers.forEach((wrapper, idx) => {
			if (!wrapper) return;
			const radius = baseRadius + idx * step;
			const delay = 40 * (idx + 1);
			const btn = wrapper.querySelector('.sn-tool');
			let finalized = false;
			wrapper.dataset.orbitInit = '1';
			wrapper.style.transition = 'none';
			wrapper.style.transform = `rotate(${prevAngle}deg) translate(${radius}px, 0)`;
			if (btn) {
				btn.style.transition = 'none';
				btn.style.setProperty('--sn-tool-rotation', `${-prevAngle}deg`);
				btn.style.removeProperty('--sn-tool-scale');
				btn.style.opacity = '1';
				btn.style.zIndex = '';
			}
			wrapper.getBoundingClientRect();
			const wrapperAnimation = wrapper.animate([
				{ transform: `rotate(${prevAngle}deg) translate(${radius}px, 0)`, offset: 0, easing },
				{ transform: `rotate(${newAngle}deg) translate(${radius}px, 0)`, offset: 1 }
			], {
				duration,
				delay,
				fill: 'none'
			});
			let btnAnimation = null;
			if (btn) {
				btnAnimation = btn.animate([
					{ transform: `translate(-50%, -50%) rotate(${-prevAngle}deg) scale(1)`, offset: 0, easing },
					{ transform: `translate(-50%, -50%) rotate(${-newAngle}deg) scale(1)`, offset: 1 }
				], {
					duration,
					delay,
					fill: 'none'
				});
			}
			const finalize = () => {
				if (finalized) return;
				finalized = true;
				const prevWrapperTransition = wrapper.style.transition;
				wrapper.style.transition = 'none';
				wrapper.style.transform = `rotate(${newAngle}deg) translate(${radius}px, 0)`;
				wrapper.getBoundingClientRect();
				wrapper.style.transition = prevWrapperTransition || '';
				if (btn) {
					const prevBtnTransition = btn.style.transition;
					btn.style.transition = 'none';
					btn.style.setProperty('--sn-tool-rotation', `${-newAngle}deg`);
					btn.style.removeProperty('--sn-tool-scale');
					btn.style.opacity = '';
					btn.style.zIndex = '';
					btn.getBoundingClientRect();
					btn.style.transition = prevBtnTransition || '';
				}
				this._activeToolAnimations = this._activeToolAnimations.filter((entry) => {
					if (!entry) return false;
					if (entry.type === 'animation' && (entry.animation === wrapperAnimation || entry.animation === btnAnimation)) return false;
					if (entry.type === 'cleanup' && entry.fn === finalize) return false;
					return true;
				});
			};
			if (wrapperAnimation) {
				wrapperAnimation.onfinish = finalize;
				wrapperAnimation.oncancel = finalize;
				this._activeToolAnimations.push({ type: 'animation', animation: wrapperAnimation });
			}
			if (btnAnimation) {
				const clearBtnTransition = () => {
					if (!btn) return;
					btn.style.transition = '';
				};
				btnAnimation.onfinish = clearBtnTransition;
				btnAnimation.oncancel = clearBtnTransition;
				this._activeToolAnimations.push({ type: 'animation', animation: btnAnimation });
			}
			this._activeToolAnimations.push({ type: 'cleanup', fn: finalize });
		});
	}

	_isOppositeDirection(a, b) {
		if (!a || !b) return false;
		return (a === 'left' && b === 'right')
			|| (a === 'right' && b === 'left')
			|| (a === 'top' && b === 'bottom')
			|| (a === 'bottom' && b === 'top');
	}

	_isQuarterTurn(a, b) {
		if (!a || !b || a === b) return false;
		const angleMap = { right: 0, bottom: 90, left: 180, top: 270 };
		const prev = angleMap[a];
		const next = angleMap[b];
		if (prev === undefined || next === undefined) return false;
		const diff = (next - prev + 360) % 360;
		return diff === 90 || diff === 270;
	}

	_polarToCartesian(angleDeg, radius) {
		const rad = (angleDeg * Math.PI) / 180;
		return {
			x: Math.cos(rad) * radius,
			y: Math.sin(rad) * radius
		};
	}

	setDirection(dir = 'bottom') {
		const allowed = ['top', 'right', 'bottom', 'left'];
		const d = allowed.includes(dir) ? dir : 'bottom';
		const prev = this._direction;
		const isOpen = this.root && this.root.classList && this.root.classList.contains('open');
		if (prev === d) {
			this.root.setAttribute('data-direction', d);
			this._applyToolOrder();
			this._updateToolPositions(d, { animate: isOpen, previousDirection: prev });
			this._direction = d;
			return false;
		}
		this.root.setAttribute('data-direction', d);
		this._applyToolOrder();
		if (prev === null) {
			this._updateToolPositions(d, { animate: false });
			this._direction = d;
			return true;
		}
		const shouldFlip = this._isOppositeDirection(prev, d);
		this._updateToolPositions(d, {
			animate: isOpen,
			previousDirection: prev,
			mode: shouldFlip ? 'flip' : 'default'
		});
		this._direction = d;
		return true;
	}
}
