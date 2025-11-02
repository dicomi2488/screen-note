// stroke-index.js
// 维护一个基于网格的快速命中索引，判断某点是否落在已有笔划附近。
// 只针对 pen-tool 的矢量点，避免复杂像素采样。
// 使用 HistoryManager 推入 stroke 时更新。

const CELL_SIZE = 48; // 可调：性能 vs 精度
const DIST_THRESHOLD_SQ = 10 * 10; // 点到线段/点近似距离阈值平方

export default class StrokeIndex {
  constructor({ bus, history }) {
    this.bus = bus;
    this.history = history;
    // Map<cellKey, Set<strokeId>>
    this.grid = new Map();
    // Map<strokeId, strokeData>
    this.strokes = new Map();
    this._bindBus();
  }

  _bindBus() {
    if (!this.bus) return;
    // 监听历史新笔划
    this.bus.on && this.bus.on('history:changed', () => {
      // 这里不细分，只在 pushStroke 时会触发，性能可接受
      this._rebuildFull();
    });
    this.bus.on && this.bus.on('history:undo', () => this._rebuildFull());
    this.bus.on && this.bus.on('history:redo', () => this._rebuildFull());
    this.bus.on && this.bus.on('history:cleared', () => this._clear());
  }

  _clear() {
    this.grid.clear();
    this.strokes.clear();
  }

  _rebuildFull() {
    this._clear();
    if (!this.history) return;
    let idx = 0;
    for (const entry of this.history.past) {
      if (entry.type !== 'stroke' || !entry.data) continue;
      const strokeId = idx++;
      this.strokes.set(strokeId, entry.data);
      this._indexStroke(strokeId, entry.data);
    }
  }

  _indexStroke(strokeId, stroke) {
    const pts = stroke.points || stroke.data || stroke;
    if (!Array.isArray(pts) || pts.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (!p) continue;
      const x = p.x; const y = p.y;
      if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    // 扩展 1 个阈值范围，以便允许距离近但不在精确点上的命中
    minX -= 10; minY -= 10; maxX += 10; maxY += 10;
    const startCellX = Math.floor(minX / CELL_SIZE);
    const startCellY = Math.floor(minY / CELL_SIZE);
    const endCellX = Math.floor(maxX / CELL_SIZE);
    const endCellY = Math.floor(maxY / CELL_SIZE);
    for (let cx = startCellX; cx <= endCellX; cx++) {
      for (let cy = startCellY; cy <= endCellY; cy++) {
        const key = cx + ':' + cy;
        let set = this.grid.get(key);
        if (!set) { set = new Set(); this.grid.set(key, set); }
        set.add(strokeId);
      }
    }
  }

  isPointNearStroke(x, y) {
    const cellX = Math.floor(x / CELL_SIZE);
    const cellY = Math.floor(y / CELL_SIZE);
    const key = cellX + ':' + cellY;
    const candidates = this.grid.get(key);
    if (!candidates || candidates.size === 0) return false;
    // 粗判后细判：检查与每条笔划的最近点或线段距离
    for (const strokeId of candidates) {
      const stroke = this.strokes.get(strokeId);
      if (!stroke) continue;
      const pts = stroke.points || stroke.data || stroke;
      if (!Array.isArray(pts) || pts.length === 0) continue;
      // 快速：直接检查点集合最近距离（不做线段投影优化）
      let best = Infinity;
      for (const p of pts) {
        const dx = p.x - x; const dy = p.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best) best = d2;
        if (best <= DIST_THRESHOLD_SQ) return true;
      }
    }
    return false;
  }
}
