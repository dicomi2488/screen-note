// 简单设置模态框，仅在点击设置时显示
export default class SettingsModal {
  constructor({ bus } = {}) {
    this.bus = bus;
    this._create();
    this._visible = false;
    this._showRaf = null;
    this._handleTransitionEnd = this._handleTransitionEnd.bind(this);
    this.root.addEventListener('transitionend', this._handleTransitionEnd);
  }

  _create() {
    this.root = document.createElement('div');
    this.root.className = 'sn-settings-modal';
    this.root.innerHTML = `
      <div class="sn-modal-backdrop"></div>
      <div class="sn-modal">
        <h3>设置</h3>
        <div class="sn-setting-row">
          <label for="sn-direction-select">弹出方向</label>
          <select id="sn-direction-select">
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </div>
        <div style="margin-top:12px"><button class="sn-close">关闭</button></div>
      </div>
    `;
    this.root.style.display = 'none';
    document.body.appendChild(this.root);
    this.root.querySelector('.sn-close').addEventListener('click', () => this.hide());
    this.root.querySelector('.sn-modal-backdrop').addEventListener('click', () => this.hide());

    this._directionSelect = this.root.querySelector('#sn-direction-select');
    const sel = this._directionSelect;
    if (!sel) return;

    sel.addEventListener('change', (e) => {
      const v = e.target.value;
      if (this.bus && this.bus.emit) this.bus.emit('ui:direction', { direction: v });
    });
  }

  _syncDirectionSelect() {
    const sel = this._directionSelect;
    if (!sel) return;
    try {
      const fb = document.querySelector('.sn-floating');
      if (fb && sel) {
        const d = fb.getAttribute('data-direction') || 'bottom';
        sel.value = d;
      }
    } catch (e) {}
  }

  show() {
    this._syncDirectionSelect();

    if (this._showRaf) {
      cancelAnimationFrame(this._showRaf);
      this._showRaf = null;
    }

    const wasVisible = this._visible;
    this._visible = true;
    this.root.style.display = 'block';

    if (wasVisible) {
      this.root.classList.add('is-visible');
      return;
    }

    this._showRaf = requestAnimationFrame(() => {
      // force reflow so CSS transitions run even after display toggles
      void this.root.offsetWidth;
      this.root.classList.add('is-visible');
      this._showRaf = null;
    });
  }

  hide() {
    if (this._showRaf) {
      cancelAnimationFrame(this._showRaf);
      this._showRaf = null;
    }

    const hadVisibleClass = this.root.classList.contains('is-visible');
    this.root.classList.remove('is-visible');
    this._visible = false;

    if (!hadVisibleClass) {
      this.root.style.display = 'none';
    }
  }

  _handleTransitionEnd(event) {
    if (event.target !== this.root) return;
    if (this.root.classList.contains('is-visible')) return;
    this.root.style.display = 'none';
  }
}
