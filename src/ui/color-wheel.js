const TAU = Math.PI * 2;

function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
}

function hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function rgbToHex({ r, g, b }) {
    const toHex = (n) => {
        const v = Math.max(0, Math.min(255, n));
        return v.toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
}

function hexToRgb(hex = '') {
    const normalized = hex.trim().replace(/^#/,'');
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
    const num = parseInt(normalized, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function rgbToHsv({ r, g, b }) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    let s = max === 0 ? 0 : d / max;
    const v = max;
    if (d !== 0) {
        switch (max) {
            case rn:
                h = (gn - bn) / d + (gn < bn ? 6 : 0);
                break;
            case gn:
                h = (bn - rn) / d + 2;
                break;
            case bn:
                h = (rn - gn) / d + 4;
                break;
        }
        h /= 6;
    }
    return { h, s, v };
}

export default class ColorWheel {
    constructor({ onChange, onClose } = {}) {
        this.onChange = typeof onChange === 'function' ? onChange : null;
        this.onClose = typeof onClose === 'function' ? onClose : null;
        this._visible = false;
        this._size = 220;
        this._value = 1;
        this._lastNonZeroValue = 1;
        this._hue = 0;
        this._saturation = 0;
        this._layoutSyncFrame = null;
        this._build();
        this._renderWheel();
        this.setColor('#000000', { silent: true });
    }

    _build() {
        this.root = document.createElement('div');
        this.root.className = 'sn-color-wheel';
        this.root.innerHTML = `
            <div class="sn-color-wheel__preview">
                <div class="sn-color-wheel__swatches">
                    <span class="sn-color-wheel__swatch"></span>
                    <span class="sn-color-wheel__swatch sn-color-wheel__swatch--previous"></span>
                </div>
                <button type="button" class="sn-color-wheel__eyedropper" title="拾色器" aria-label="启用拾色器">
                    <img src="src/icons/color_picker.svg" alt="拾色器" draggable="false" />
                </button>
                <input class="sn-color-wheel__input" value="#000000" maxlength="7" spellcheck="false" aria-label="颜色十六进制值" />
            </div>
            <div class="sn-color-wheel__main">
                <div class="sn-color-wheel__wheel" role="presentation">
                    <canvas class="sn-color-wheel__canvas" width="${this._size}" height="${this._size}"></canvas>
                    <div class="sn-color-wheel__cursor"></div>
                </div>
                <div class="sn-color-wheel__slider" role="presentation">
                    <div class="sn-color-wheel__slider-track">
                        <div class="sn-color-wheel__slider-thumb"></div>
                    </div>
                </div>
            </div>
            <div class="sn-color-wheel__footer">
                <button type="button" class="sn-color-wheel__done">完成</button>
            </div>
        `;
        this.canvas = this.root.querySelector('.sn-color-wheel__canvas');
        this.cursor = this.root.querySelector('.sn-color-wheel__cursor');
        this.input = this.root.querySelector('.sn-color-wheel__input');
        this.swatchCurrent = this.root.querySelector('.sn-color-wheel__swatch');
        this.swatchPrevious = this.root.querySelector('.sn-color-wheel__swatch--previous');
        this.sliderTrack = this.root.querySelector('.sn-color-wheel__slider-track');
        this.sliderThumb = this.root.querySelector('.sn-color-wheel__slider-thumb');
        this.doneBtn = this.root.querySelector('.sn-color-wheel__done');
        this.eyeDropperBtn = this.root.querySelector('.sn-color-wheel__eyedropper');
        this._ctx = this.canvas.getContext('2d');
        this._wheelRect = this.canvas.getBoundingClientRect();
        this._wheelRadius = this._size / 2;
        this._bind();
    }

    _bind() {
        this._handleWheelPointerDown = this._handleWheelPointerDown.bind(this);
        this._handleWheelPointerMove = this._handleWheelPointerMove.bind(this);
        this._handleWheelPointerUp = this._handleWheelPointerUp.bind(this);
        this._handleSliderDown = this._handleSliderDown.bind(this);
        this._handleSliderMove = this._handleSliderMove.bind(this);
        this._handleSliderUp = this._handleSliderUp.bind(this);
        this._onInputChange = this._onInputChange.bind(this);
        this._onDone = this._onDone.bind(this);
        this._onEyeDropperClick = this._onEyeDropperClick.bind(this);
        this.canvas.addEventListener('pointerdown', this._handleWheelPointerDown);
        this.sliderTrack.addEventListener('pointerdown', this._handleSliderDown);
        this.input.addEventListener('change', this._onInputChange);
        this.input.addEventListener('blur', this._onInputChange);
        this.doneBtn.addEventListener('click', this._onDone);
        if (this.eyeDropperBtn) this.eyeDropperBtn.addEventListener('click', this._onEyeDropperClick);
    }

    _renderWheel() {
        const size = this._size;
        const radius = size / 2;
        const image = this._ctx.createImageData(size, size);
        const data = image.data;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - radius;
                const dy = y - radius;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const idx = (y * size + x) * 4;
                if (dist > radius) {
                    data[idx + 3] = 0;
                    continue;
                }
                let angle = Math.atan2(dy, dx);
                if (angle < 0) angle += TAU;
                const hue = angle / TAU;
                const sat = clamp(dist / radius, 0, 1);
                const { r, g, b } = hsvToRgb(hue, sat, 1);
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }
        this._ctx.putImageData(image, 0, 0);
    }

    mount(container) {
        if (!container) return;
        container.appendChild(this.root);
    }

    show(color) {
        if (color) this.setColor(color, { silent: true });
        this._visible = true;
        this.root.classList.add('is-visible');
        this._syncWheelRect();
        this._updateUI();
        this._scheduleLayoutSync();
    }

    hide() {
        if (!this._visible) return;
        this._visible = false;
        this.root.classList.remove('is-visible');
        this._cancelLayoutSync();
        if (this.onClose) this.onClose();
    }

    isVisible() {
        return this._visible;
    }

    setColor(color, { silent = false } = {}) {
        const rgb = typeof color === 'string' ? hexToRgb(color) : color;
        if (!rgb) return;
        const { h, s, v } = rgbToHsv(rgb);
        this._hue = clamp(h, 0, 1);
        this._saturation = clamp(s, 0, 1);
        this._value = clamp(v, 0, 1);
        if (this._value > 0) this._lastNonZeroValue = this._value;
        this._previousHex = this._currentHex || rgbToHex(rgb);
        this._updateUI();
        if (!silent) this._emitChange(false);
    }

    _syncWheelRect() {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect) return;
        this._wheelRect = rect;
        const measuredRadius = rect.width / 2;
        this._wheelRadius = measuredRadius > 0 ? measuredRadius : this._size / 2;
    }

    _computeSliderFromEvent(e, final) {
        const rect = this.sliderTrack.getBoundingClientRect();
        const ratio = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        this._value = clamp(1 - ratio, 0, 1);
        if (this._value > 0) this._lastNonZeroValue = this._value;
        this._updateUI();
        this._emitChange(final);
    }

    _onInputChange() {
        const value = this.input.value.trim();
        if (!/^#?[0-9a-f]{6}$/i.test(value)) {
            this._updateUI();
            return;
        }
        const rgb = hexToRgb(value.startsWith('#') ? value : `#${value}`);
        if (!rgb) return;
        this.setColor(rgb);
        this._emitChange(true);
    }

    _onDone() {
        this._emitChange(true);
        this.hide();
    }

    _emitChange(final = false) {
        const rgb = hsvToRgb(this._hue, this._saturation, this._value);
        const hex = rgbToHex(rgb);
        this._currentHex = hex;
        if (this.onChange) this.onChange({ color: hex, final });
    }

    _updateUI() {
        const rgbFull = hsvToRgb(this._hue, this._saturation, 1);
        const rgbValue = hsvToRgb(this._hue, this._saturation, this._value);
        const hexFull = rgbToHex(rgbFull);
        const hexValue = rgbToHex(rgbValue);
        this._currentHex = hexValue;
        if (this.swatchCurrent) {
            this.swatchCurrent.style.background = hexValue;
        }
        if (this.swatchPrevious) {
            this.swatchPrevious.style.background = this._previousHex || hexValue;
        }
        if (this.input) {
            this.input.value = hexValue;
        }
        this._updateCursor();
        this._updateSlider(hexFull);
    }

    _updateCursor() {
        if (!this.cursor) return;
        const radius = this._wheelRadius;
        const angle = this._hue * TAU;
        const dist = this._saturation * radius;
        const x = radius + Math.cos(angle) * dist;
        const y = radius + Math.sin(angle) * dist;
        this.cursor.style.left = `${x}px`;
        this.cursor.style.top = `${y}px`;
    }

    _updateSlider(hexFull) {
        if (!this.sliderTrack || !this.sliderThumb) return;
        this.sliderTrack.style.background = `linear-gradient(180deg, #ffffff 0%, ${hexFull} 50%, #000000 100%)`;
        const rect = this.sliderTrack.getBoundingClientRect();
        const height = rect.height || 1;
        const position = (1 - this._value) * height;
        const clamped = clamp(position, 0, height);
        this.sliderThumb.style.transform = `translate(-50%, ${clamped - 12}px)`;
    }

    destroy() {
        this.canvas.removeEventListener('pointerdown', this._handleWheelPointerDown);
        this.sliderTrack.removeEventListener('pointerdown', this._handleSliderDown);
        this.input.removeEventListener('change', this._onInputChange);
        this._cancelLayoutSync();
        this.input.removeEventListener('blur', this._onInputChange);
        this.doneBtn.removeEventListener('click', this._onDone);
        if (this.eyeDropperBtn) this.eyeDropperBtn.removeEventListener('click', this._onEyeDropperClick);
        window.removeEventListener('pointermove', this._handleWheelPointerMove);
        window.removeEventListener('pointerup', this._handleWheelPointerUp);
        window.removeEventListener('pointercancel', this._handleWheelPointerUp);
        window.removeEventListener('pointermove', this._handleSliderMove);
        window.removeEventListener('pointerup', this._handleSliderUp);
        window.removeEventListener('pointercancel', this._handleSliderUp);
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    }

    _handleWheelPointerDown(e) {
        e.preventDefault();
        this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
        this._wheelDragging = true;
        this._syncWheelRect();
        this._handleWheelPointerMove(e);
        window.addEventListener('pointermove', this._handleWheelPointerMove);
        window.addEventListener('pointerup', this._handleWheelPointerUp);
        window.addEventListener('pointercancel', this._handleWheelPointerUp);
    }

    _handleWheelPointerMove(e) {
        if (!this._wheelDragging) return;
        const rect = this._wheelRect;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - rect.width / 2;
        const dy = y - rect.height / 2;
        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += TAU;
        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), this._wheelRadius);
        this._hue = clamp(angle / TAU, 0, 1);
        this._saturation = clamp(dist / this._wheelRadius, 0, 1);
        if (this._value === 0) {
            this._value = this._lastNonZeroValue || 1;
        }
        this._updateUI();
        this._emitChange(false);
    }

    _handleWheelPointerUp(e) {
        if (!this._wheelDragging) return;
        this._wheelDragging = false;
        try {
            this.canvas.releasePointerCapture && this.canvas.releasePointerCapture(e.pointerId);
        } catch (err) {}
        window.removeEventListener('pointermove', this._handleWheelPointerMove);
        window.removeEventListener('pointerup', this._handleWheelPointerUp);
        window.removeEventListener('pointercancel', this._handleWheelPointerUp);
        this._emitChange(true);
    }

    _handleSliderDown(e) {
        e.preventDefault();
        this.sliderTrack.setPointerCapture && this.sliderTrack.setPointerCapture(e.pointerId);
        this._sliderDragging = true;
        this._computeSliderFromEvent(e, false);
        window.addEventListener('pointermove', this._handleSliderMove);
        window.addEventListener('pointerup', this._handleSliderUp);
        window.addEventListener('pointercancel', this._handleSliderUp);
    }

    _handleSliderMove(e) {
        if (!this._sliderDragging) return;
        this._computeSliderFromEvent(e, false);
    }

    _handleSliderUp(e) {
        if (!this._sliderDragging) return;
        this._sliderDragging = false;
        try {
            this.sliderTrack.releasePointerCapture && this.sliderTrack.releasePointerCapture(e.pointerId);
        } catch (err) {}
        window.removeEventListener('pointermove', this._handleSliderMove);
        window.removeEventListener('pointerup', this._handleSliderUp);
        window.removeEventListener('pointercancel', this._handleSliderUp);
        this._emitChange(true);
    }

    async _onEyeDropperClick() {
        if (this._eyeDropperActive) return;
        if (typeof window === 'undefined' || typeof window.EyeDropper !== 'function') {
            console.warn('EyeDropper API is unavailable in this environment.');
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('当前浏览器不支持拾色器功能。');
            }
            return;
        }
        try {
            this._eyeDropperActive = true;
            const dropper = new window.EyeDropper();
            const result = await dropper.open();
            if (result && result.sRGBHex) {
                this.setColor(result.sRGBHex, { silent: true });
                this._emitChange(true);
            }
        } catch (err) {
            if (err && err.name !== 'AbortError') {
                console.warn('EyeDropper failed', err);
            }
        } finally {
            this._eyeDropperActive = false;
        }
    }

    _scheduleLayoutSync() {
        this._cancelLayoutSync();
        this._layoutSyncFrame = window.requestAnimationFrame(() => {
            this._layoutSyncFrame = null;
            if (!this._visible) return;
            this._syncWheelRect();
            this._updateCursor();
        });
    }

    _cancelLayoutSync() {
        if (this._layoutSyncFrame !== null) {
            window.cancelAnimationFrame(this._layoutSyncFrame);
            this._layoutSyncFrame = null;
        }
    }
}
