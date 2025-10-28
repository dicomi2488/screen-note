import { computePositionForSide } from '../utils/positioning.js';

const DEFAULT_WIDTH = 24;

export default class EraserPanel {
	constructor({ bus } = {}) {
		this.bus = bus;
		this._width = DEFAULT_WIDTH;
		this._isOpen = false;
		this._preferredSide = 'bottom';
		this._layout = 'horizontal';
		this._clearOffset = 0;
		this._clearMax = 0;
		this._clearActive = false;
		this._clearLocked = false;
		this._bindHandlers();
		this._build();
		this._attachBus();
	}

	_bindHandlers() {
		this._onOutsidePointerDown = this._onOutsidePointerDown.bind(this);
		this._onResize = this._onResize.bind(this);
		this._onWidthInput = this._onWidthInput.bind(this);
		this._onClearPointerDown = this._onClearPointerDown.bind(this);
		this._onClearPointerMove = this._onClearPointerMove.bind(this);
		this._onClearPointerUp = this._onClearPointerUp.bind(this);
	}

	_build() {
		this.root = document.createElement('div');
		this.root.className = 'sn-eraser-panel';
		this.root.setAttribute('role', 'dialog');
		this.root.setAttribute('aria-label', '橡皮设置');
		this.root.setAttribute('aria-hidden', 'true');

		this.root.innerHTML = `
			<div class="sn-eraser-panel__thickness">
				<div class="sn-eraser-thickness__header">
					<span>粗细</span>
					<span class="sn-eraser-thickness__value">${DEFAULT_WIDTH}px</span>
				</div>
				<div class="sn-eraser-thickness__slider-wrapper">
					<input class="sn-eraser-thickness__slider" type="range" min="4" max="64" step="1" value="${DEFAULT_WIDTH}" />
				</div>
			</div>
			<div class="sn-eraser-panel__clear">
				<div class="sn-clear-label">拖动滑块清空画布</div>
				<div class="sn-clear-track">
					<div class="sn-clear-track__progress"></div>
					<button type="button" class="sn-clear-thumb" aria-label="拖动滑块清空画布">
						<span class="sn-clear-thumb__icon">&raquo;</span>
					</button>
				</div>
			</div>
		`;

		document.body.appendChild(this.root);

		this._widthValueEl = this.root.querySelector('.sn-eraser-thickness__value');
		this._slider = this.root.querySelector('.sn-eraser-thickness__slider');
		this._clearLabel = this.root.querySelector('.sn-clear-label');
		this._clearTrack = this.root.querySelector('.sn-clear-track');
		this._clearThumb = this.root.querySelector('.sn-clear-thumb');
		this._clearProgress = this.root.querySelector('.sn-clear-track__progress');

		if (this._slider) {
			this._slider.addEventListener('input', this._onWidthInput);
			this._slider.addEventListener('change', this._onWidthInput);
		}

		if (this._clearThumb) {
			this._clearThumb.addEventListener('pointerdown', this._onClearPointerDown);
			this._clearThumb.addEventListener('pointermove', this._onClearPointerMove);
			this._clearThumb.addEventListener('pointerup', this._onClearPointerUp);
			this._clearThumb.addEventListener('pointercancel', this._onClearPointerUp);
		}

		this._updateWidthUI(this._width);
		this._resetClearSlider({ animate: false });
	}

	_attachBus() {
		if (!this.bus || !this.bus.on) return;
		this.bus.on('tool:eraserWidth', ({ width } = {}) => {
			if (typeof width !== 'number') return;
			this._width = width;
			this._updateWidthUI(width);
		});
	}

	_onWidthInput(e) {
		const value = Number(e.target.value);
		if (Number.isNaN(value)) return;
		this._width = value;
		this._updateWidthUI(value);
		if (this.bus) this.bus.emit('tool:eraserWidth', { width: value });
	}

	_updateWidthUI(width) {
		if (this._slider && Number(this._slider.value) !== width) {
			this._slider.value = String(width);
		}
		if (this._widthValueEl) this._widthValueEl.textContent = width + 'px';
	}

	show(anchorElement, direction = 'right') {
		if (!anchorElement) return;
		this._anchor = anchorElement;
		const { side, layout } = this._resolveConfig(anchorElement, direction);
		const layoutChanged = this._layout !== layout;
		this._layout = layout;
		this._preferredSide = side;
		this._direction = direction;
		this._applyLayout(layoutChanged);
		if (!this._isOpen) {
			this._isOpen = true;
			this.root.classList.add('is-visible');
			this.root.setAttribute('aria-hidden', 'false');
			window.addEventListener('pointerdown', this._onOutsidePointerDown, true);
			window.addEventListener('resize', this._onResize);
		}
		this._position();
	}

	hide() {
		if (!this._isOpen) return;
		this._isOpen = false;
		this.root.classList.remove('is-visible');
		this.root.setAttribute('aria-hidden', 'true');
		window.removeEventListener('pointerdown', this._onOutsidePointerDown, true);
		window.removeEventListener('resize', this._onResize);
		this._anchor = null;
		this._direction = null;
		this._clearActive = false;
		this._clearLocked = false;
		this._resetClearSlider({ animate: false });
	}

	toggle(anchorElement, direction = 'right') {
		if (this._isOpen) {
			if (anchorElement && this._anchor === anchorElement) {
				this.hide();
				return;
			}
		}
		this.show(anchorElement, direction);
	}

	isOpen() {
		return this._isOpen;
	}

	refresh(direction = this._direction) {
		if (!this._isOpen || !this._anchor) return;
		this.show(this._anchor, direction || this._direction || 'right');
	}

	_position() {
		if (!this._anchor) return;
		const anchorRect = this._anchor.getBoundingClientRect();
		const popupW = this.root.offsetWidth || this.root.getBoundingClientRect().width || 0;
		const popupH = this.root.offsetHeight || this.root.getBoundingClientRect().height || 0;
		const containerRect = { left: 0, top: 0 };
		const pos = computePositionForSide(this._preferredSide || 'top', anchorRect, popupW, popupH, containerRect, 12);
		let { left, top } = pos;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		left = Math.min(Math.max(8, left), vw - popupW - 8);
		top = Math.min(Math.max(8, top), vh - popupH - 8);
		this.root.style.left = left + 'px';
		this.root.style.top = top + 'px';
		this._updateClearMetrics();
	}

	_resolveConfig(anchorElement, direction) {
		const rect = anchorElement.getBoundingClientRect();
		const centerX = window.innerWidth / 2;
		const centerY = window.innerHeight / 2;
		if (direction === 'left' || direction === 'right') {
			const anchorCenterY = rect.top + rect.height / 2;
			const side = anchorCenterY > centerY ? 'top' : 'bottom';
			return { side, layout: 'horizontal' };
		}
		const anchorCenterX = rect.left + rect.width / 2;
		const side = anchorCenterX > centerX ? 'left' : 'right';
		return { side, layout: 'vertical' };
	}

	_applyLayout(layoutChanged) {
		const isVertical = this._layout === 'vertical';
		this.root.classList.toggle('sn-eraser-panel--vertical', isVertical);
		if (layoutChanged) {
			this._resetClearSlider({ animate: false });
			this._updateClearMetrics();
		}
	}

	_updateClearMetrics() {
		if (!this._clearTrack || !this._clearThumb) return;
		const trackRect = this._clearTrack.getBoundingClientRect();
		const thumbRect = this._clearThumb.getBoundingClientRect();
		if (this._layout === 'vertical') {
			this._clearMax = Math.max(0, trackRect.height - thumbRect.height - 4);
		} else {
			this._clearMax = Math.max(0, trackRect.width - thumbRect.width - 4);
		}
		this._thumbSize = this._layout === 'vertical' ? thumbRect.height : thumbRect.width;
		this._trackLength = this._layout === 'vertical' ? trackRect.height : trackRect.width;
		this._applyClearOffset(this._clearOffset || 0, { silent: true });
	}

	_applyClearOffset(value, { silent = false } = {}) {
		if (!this._clearThumb || !this._clearProgress) return;
		const clamped = Math.max(0, Math.min(value, this._clearMax));
		this._clearOffset = clamped;
		const totalTravel = (this._clearMax || 0) + (this._thumbSize || 0);
		const progress = this._clearMax > 0 ? clamped / this._clearMax : 0;
		const fillRatio = totalTravel > 0 ? Math.min(1, (clamped + (this._thumbSize || 0)) / totalTravel) : progress;
		if (this._layout === 'vertical') {
			this._clearThumb.style.transform = `translateY(${clamped}px)`;
			this._clearProgress.style.height = `${fillRatio * 100}%`;
			this._clearProgress.style.width = '100%';
		} else {
			this._clearThumb.style.transform = `translateX(${clamped}px)`;
			this._clearProgress.style.width = `${fillRatio * 100}%`;
			this._clearProgress.style.height = '100%';
		}
		if (!silent && this._clearLabel) {
			if (progress >= 0.95 && !this._clearLocked) {
				this._clearLabel.textContent = '释放以清空画布';
			} else if (!this._clearLocked) {
				this._clearLabel.textContent = '拖动滑块清空画布';
			}
		}
	}

	_onClearPointerDown(e) {
		if (this._clearLocked || !this._clearThumb) return;
		e.preventDefault();
		this._updateClearMetrics();
		this._clearActive = true;
		this._dragStart = { x: e.clientX, y: e.clientY };
		this._dragStartOffset = this._clearOffset || 0;
		if (this._clearThumb.setPointerCapture) {
			try { this._clearThumb.setPointerCapture(e.pointerId); } catch (err) {}
		}
		if (this._clearTrack) this._clearTrack.classList.add('is-dragging');
		if (this._clearLabel && !this._clearLocked) {
			this._clearLabel.textContent = '拖动至另一端以清空';
		}
	}

	_onClearPointerMove(e) {
		if (!this._clearActive) return;
		const delta = this._layout === 'vertical'
			? e.clientY - this._dragStart.y
			: e.clientX - this._dragStart.x;
		const next = this._dragStartOffset + delta;
		this._applyClearOffset(next);
	}

	_onClearPointerUp(e) {
		if (!this._clearActive) return;
		if (this._clearThumb && this._clearThumb.releasePointerCapture) {
			try { this._clearThumb.releasePointerCapture(e.pointerId); } catch (err) {}
		}
		if (this._clearTrack) this._clearTrack.classList.remove('is-dragging');
		const success = this._clearMax > 0 && this._clearOffset >= this._clearMax * 0.95;
		this._clearActive = false;
		if (success) {
			this._completeClear();
		} else {
			this._resetClearSlider({ animate: true });
		}
	}

	_completeClear() {
		if (this._clearLocked) return;
		this._clearLocked = true;
		if (this._clearTrack) this._clearTrack.classList.add('is-success');
		this._applyClearOffset(this._clearMax, { silent: true });
		if (this._clearLabel) this._clearLabel.textContent = '已清空画布';
		if (this.bus) this.bus.emit('canvas:clear');
		window.setTimeout(() => {
			this._clearLocked = false;
			if (this._clearTrack) this._clearTrack.classList.remove('is-success');
			this._resetClearSlider({ animate: true });
		}, 900);
	}

	_resetClearSlider({ animate = false } = {}) {
		if (this._clearActive) return;
		if (this._clearThumb) {
			this._clearThumb.style.transition = animate ? 'transform 200ms cubic-bezier(.2,.9,.2,1)' : 'none';
		}
		if (this._clearProgress) {
			const prop = this._layout === 'vertical' ? 'height' : 'width';
			this._clearProgress.style.transition = animate ? `${prop} 200ms ease` : 'none';
		}
		this._applyClearOffset(0, { silent: true });
		if (this._clearLabel) this._clearLabel.textContent = '拖动滑块清空画布';
		if (!animate) {
			requestAnimationFrame(() => {
				if (this._clearThumb) this._clearThumb.style.transition = '';
				if (this._clearProgress) this._clearProgress.style.transition = '';
			});
		} else {
			if (this._clearThumb) {
				window.setTimeout(() => {
					if (this._clearThumb) this._clearThumb.style.transition = '';
				}, 220);
			}
			if (this._clearProgress) {
				window.setTimeout(() => {
					if (this._clearProgress) this._clearProgress.style.transition = '';
				}, 220);
			}
		}
	}

	_onOutsidePointerDown(e) {
		if (!this._isOpen) return;
		const path = e.composedPath ? e.composedPath() : [];
		if (path.includes(this.root)) return;
		if (this._anchor && path.includes(this._anchor)) return;
		this.hide();
	}

	_onResize() {
		if (!this._isOpen) return;
		this._updateClearMetrics();
		this._position();
	}
}
