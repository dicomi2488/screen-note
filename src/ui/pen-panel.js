import { computePositionForSide } from '../utils/positioning.js';
import ColorWheel from './color-wheel.js';

const COLORS = [
	{ label: '黑色', value: '#000000' },
	{ label: '红色', value: '#ff3b30' },
	{ label: '蓝色', value: '#007aff' },
	{ label: '绿色', value: '#34c759' },
	{ label: '白色', value: '#ffffff' },
];

const DEFAULT_WIDTH = 4;

export default class PenPanel {
	constructor({ bus } = {}) {
		this.bus = bus;
		this._color = COLORS[0].value;
		this._width = DEFAULT_WIDTH;
		this._isOpen = false;
		this._preferredSide = 'bottom';
		this._layout = 'horizontal';
		this._colorWheelOpen = false;
		this._bindHandlers();
		this._build();
		this._attachBus();
	}

	_bindHandlers() {
		this._onOutsidePointerDown = this._onOutsidePointerDown.bind(this);
		this._onResize = this._onResize.bind(this);
	}

	_build() {
		this.root = document.createElement('div');
		this.root.className = 'sn-pen-panel';
		this.root.setAttribute('role', 'dialog');
		this.root.setAttribute('aria-label', '画笔设置');
		this.root.setAttribute('aria-hidden', 'true');

		const colorsRow = document.createElement('div');
		colorsRow.className = 'sn-pen-panel__colors';

		COLORS.forEach(({ label, value }) => {
			const btn = document.createElement('button');
			btn.className = 'sn-pen-color';
			btn.type = 'button';
			btn.setAttribute('data-color', value);
			btn.setAttribute('aria-label', label);
			btn.innerHTML = '<span class="sn-pen-color__swatch"></span>';
			const swatch = btn.querySelector('.sn-pen-color__swatch');
			if (swatch) {
				swatch.style.background = value;
				swatch.style.color = value;
			}
			btn.addEventListener('click', () => this._selectColor(value));
			colorsRow.appendChild(btn);
		});

		const pickerBtn = document.createElement('button');
		pickerBtn.className = 'sn-pen-color sn-pen-color--picker';
		pickerBtn.type = 'button';
		pickerBtn.setAttribute('data-color', 'picker');
		pickerBtn.setAttribute('aria-label', '更多颜色');
		pickerBtn.innerHTML = '<span class="sn-pen-color__swatch"><img src="src/icons/color.svg" alt="更多颜色" draggable="false" /></span>';
		pickerBtn.addEventListener('click', () => this._onPickerClick());
		colorsRow.appendChild(pickerBtn);

		const thicknessSection = document.createElement('div');
		thicknessSection.className = 'sn-pen-panel__thickness';

		const thicknessHeader = document.createElement('div');
		thicknessHeader.className = 'sn-pen-thickness__header';
		thicknessHeader.innerHTML = '<span>粗细</span><span class="sn-pen-thickness__value">4px</span>';

		const sliderWrapper = document.createElement('div');
		sliderWrapper.className = 'sn-pen-thickness__slider-wrapper';

		const slider = document.createElement('input');
		slider.className = 'sn-pen-thickness__slider';
		slider.type = 'range';
		slider.min = '1';
		slider.max = '16';
		slider.step = '1';
		slider.value = String(DEFAULT_WIDTH);
		slider.addEventListener('input', () => this._onWidthChange(slider));
		slider.addEventListener('change', () => this._onWidthChange(slider));

		sliderWrapper.appendChild(slider);

		thicknessSection.appendChild(thicknessHeader);
		thicknessSection.appendChild(sliderWrapper);

		const colorWheelSection = document.createElement('div');
		colorWheelSection.className = 'sn-pen-panel__color-wheel';
		colorWheelSection.setAttribute('aria-hidden', 'true');

		const controlsSection = document.createElement('div');
		controlsSection.className = 'sn-pen-panel__controls';
		controlsSection.appendChild(colorsRow);
		controlsSection.appendChild(thicknessSection);

		this.root.appendChild(colorWheelSection);
		this.root.appendChild(controlsSection);

		document.body.appendChild(this.root);
		this._thicknessValueEl = thicknessHeader.querySelector('.sn-pen-thickness__value');
		this._slider = slider;
		this._updateActiveColor();
		this._updateWidthUI(this._width);

		this._colorWheelContainer = colorWheelSection;
		this._controlsSection = controlsSection;
		this._colorsSection = colorsRow;
		this._thicknessSection = thicknessSection;
		this._colorWheel = new ColorWheel({
			onChange: ({ color, final } = {}) => {
				if (!color) return;
				this._color = color;
				this._updateActiveColor();
				if (this.bus) this.bus.emit('tool:color', { color });
			},
			onClose: () => {
				this._handleColorWheelClosed();
			}
		});
		this._colorWheel.mount(colorWheelSection);
		this._setColorWheelOpen(false, { silent: true });
		this._updateColorWheelPlacement();
	}

	_attachBus() {
		if (!this.bus || !this.bus.on) return;
		this.bus.on('tool:color', ({ color } = {}) => {
			if (!color) return;
			this._color = color;
			this._updateActiveColor();
			if (this._colorWheel && this._colorWheel.isVisible()) {
				this._colorWheel.setColor(color, { silent: true });
			}
		});
		this.bus.on('tool:penWidth', ({ width } = {}) => {
			if (typeof width !== 'number') return;
			this._width = width;
			this._updateWidthUI(width);
		});
	}

	_selectColor(color) {
		this._color = color;
		this._updateActiveColor();
		if (this.bus) this.bus.emit('tool:color', { color });
		if (this._colorWheel && this._colorWheel.isVisible()) {
			this._colorWheel.setColor(color, { silent: true });
		}
	}

	_onPickerClick() {
		this._setColorWheelOpen(!this._colorWheelOpen);
		if (this._colorWheelOpen && this._colorWheel) {
			this._colorWheel.setColor(this._color, { silent: true });
		}
	}

	_onWidthChange(slider) {
		const value = Number(slider.value);
		this._width = value;
		this._updateWidthUI(value);
		if (this.bus) this.bus.emit('tool:penWidth', { width: value });
	}

	_updateActiveColor() {
		const buttons = this.root.querySelectorAll('.sn-pen-color');
		buttons.forEach((btn) => {
			const val = btn.getAttribute('data-color');
			btn.classList.toggle('is-selected', val === this._color);
		});
	}

	_updateWidthUI(width) {
		if (this._slider && Number(this._slider.value) !== width) {
			this._slider.value = String(width);
		}
		if (this._thicknessValueEl) this._thicknessValueEl.textContent = width + 'px';
	}

	_setColorWheelOpen(open, { silent = false } = {}) {
		if (!this._colorWheelContainer) return;
		this._colorWheelOpen = !!open;
		this._colorWheelContainer.classList.toggle('is-open', this._colorWheelOpen);
		this._colorWheelContainer.setAttribute('aria-hidden', this._colorWheelOpen ? 'false' : 'true');
		if (this.root) {
			this.root.classList.toggle('sn-pen-panel--color-wheel-open', this._colorWheelOpen);
		}
		if (this._colorWheel) {
			if (this._colorWheelOpen) this._colorWheel.show(this._color);
			else this._colorWheel.hide();
		}
		if (this._isOpen) this._position();
	}

	_handleColorWheelClosed() {
		if (!this._colorWheelContainer) return;
		this._colorWheelOpen = false;
		this._colorWheelContainer.classList.remove('is-open');
		this._colorWheelContainer.setAttribute('aria-hidden', 'true');
		if (this.root) this.root.classList.remove('sn-pen-panel--color-wheel-open');
		if (this._isOpen) this._position();
	}

	_updateColorWheelPlacement() {
		if (!this._colorWheelContainer || !this._controlsSection) return;
		const side = this._preferredSide || 'bottom';
		const layout = this._layout || 'horizontal';
		const c = this._colorWheelContainer;
		c.classList.remove(
			'sn-pen-panel__color-wheel--top',
			'sn-pen-panel__color-wheel--bottom',
			'sn-pen-panel__color-wheel--left',
			'sn-pen-panel__color-wheel--right'
		);
		if (layout === 'vertical') {
			const horizontalSide = side === 'left' ? 'left' : 'right';
			if (horizontalSide === 'left') {
				if (c.nextSibling !== this._controlsSection) {
					this.root.insertBefore(c, this._controlsSection);
				}
				c.classList.add('sn-pen-panel__color-wheel--left');
			} else {
				if (c.previousSibling !== this._controlsSection) {
					this.root.appendChild(c);
				}
				c.classList.add('sn-pen-panel__color-wheel--right');
			}
		} else {
			const verticalSide = side === 'top' ? 'top' : 'bottom';
			if (verticalSide === 'top') {
				if (c.nextSibling !== this._controlsSection) {
					this.root.insertBefore(c, this._controlsSection);
				}
				c.classList.add('sn-pen-panel__color-wheel--top');
			} else {
				if (c.previousSibling !== this._controlsSection) {
					this.root.appendChild(c);
				}
				c.classList.add('sn-pen-panel__color-wheel--bottom');
			}
		}
		if (this.root) {
			this.root.setAttribute('data-panel-side', side);
			this.root.setAttribute('data-panel-layout', layout);
		}
		if (this._colorWheelOpen && this._colorWheel) {
			this._colorWheel.show(this._color);
		}
	}

	show(anchorElement, direction = 'right') {
		if (!anchorElement) return;
		this._anchor = anchorElement;
		const { side, layout } = this._resolveConfig(anchorElement, direction);
		this._preferredSide = side;
		this._layout = layout;
		this._direction = direction;
		this._applyLayout(layout);
		if (!this._isOpen) {
			this._isOpen = true;
			this.root.classList.add('is-visible');
			this.root.setAttribute('aria-hidden', 'false');
			window.addEventListener('pointerdown', this._onOutsidePointerDown, true);
			window.addEventListener('resize', this._onResize);
			// 通知面板显示
			if (this.bus) this.bus.emit('ui:panel:show', { panel: 'pen' });
		}
		this._position();
	}

	hide() {
		if (!this._isOpen) return;
		this._isOpen = false;
		this.root.classList.remove('is-visible');
		this.root.setAttribute('aria-hidden', 'true');
		window.removeEventListener('pointerdown', this._onOutsidePointerDown, true);
		// 通知面板隐藏
		if (this.bus) this.bus.emit('ui:panel:hide', { panel: 'pen' });
		window.removeEventListener('resize', this._onResize);
		this._anchor = null;
		this._direction = null;
		this._setColorWheelOpen(false, { silent: true });
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
		const side = this._preferredSide || 'top';
		const popupW = this.root.offsetWidth || this.root.getBoundingClientRect().width || 0;
		const popupH = this.root.offsetHeight || this.root.getBoundingClientRect().height || 0;
		const containerRect = { left: 0, top: 0 };
		let gap = 12;
		if (this._colorWheelOpen) {
			if (side === 'top' || side === 'bottom') gap = 18;
			else gap = 16;
		}
		const pos = computePositionForSide(side, anchorRect, popupW, popupH, containerRect, gap);
		let { left, top } = pos;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		left = Math.min(Math.max(8, left), vw - popupW - 8);
		top = Math.min(Math.max(8, top), vh - popupH - 8);
		this.root.style.left = left + 'px';
		this.root.style.top = top + 'px';
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
		this._position();
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

	_applyLayout(layout) {
		const isVertical = layout === 'vertical';
		this.root.classList.toggle('sn-pen-panel--vertical', isVertical);
		this.root.classList.toggle('sn-pen-panel--horizontal', !isVertical);
		this._updateColorWheelPlacement();
	}
}
