/**
 * 鼠标透传 API 封装
 * 提供 Tauri 窗口的鼠标透传控制
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * 鼠标透传管理器
 */
export class MousePassthroughAPI {
  /**
   * 启用全窗口鼠标透传
   * 启用后，鼠标事件将穿透窗口传递到下方应用
   */
  static async enable() {
    try {
      await invoke('enable_mouse_passthrough');
      console.log('[MousePassthrough] 已启用鼠标透传');
      return true;
    } catch (error) {
      console.error('[MousePassthrough] 启用失败:', error);
      return false;
    }
  }

  /**
   * 禁用鼠标透传（恢复正常交互）
   */
  static async disable() {
    try {
      await invoke('disable_mouse_passthrough');
      console.log('[MousePassthrough] 已禁用鼠标透传');
      return true;
    } catch (error) {
      console.error('[MousePassthrough] 禁用失败:', error);
      return false;
    }
  }

  /**
   * 切换鼠标透传状态
   * @param {boolean} enabled - true 启用透传，false 禁用透传
   */
  static async toggle(enabled) {
    try {
      await invoke('toggle_mouse_passthrough', { enabled });
      console.log(`[MousePassthrough] 透传状态: ${enabled ? '启用' : '禁用'}`);
      return true;
    } catch (error) {
      console.error('[MousePassthrough] 切换失败:', error);
      return false;
    }
  }

  /**
   * 设置可交互区域
   * 只有指定的区域可以接收鼠标事件，其他区域透传
   * @param {Array<{x: number, y: number, width: number, height: number}>} regions - 可交互区域数组
   * 
   * @example
   * // 设置工具栏和按钮为可交互区域
   * await MousePassthroughAPI.setInteractiveRegions([
   *   { x: 100, y: 100, width: 200, height: 50 },  // 工具栏
   *   { x: 50, y: 50, width: 40, height: 40 }      // 浮动按钮
   * ]);
   */
  static async setInteractiveRegions(regions) {
    try {
      // 转换为整数坐标
      const formattedRegions = regions.map(r => ({
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
      }));

      await invoke('set_interactive_regions', { regions: formattedRegions });
      console.log(`[MousePassthrough] 已设置 ${formattedRegions.length} 个可交互区域`);
      return true;
    } catch (error) {
      console.error('[MousePassthrough] 设置区域失败:', error);
      return false;
    }
  }

  /**
   * 清除所有交互区域限制
   * 恢复全窗口可交互状态
   */
  static async clearInteractiveRegions() {
    try {
      await invoke('clear_interactive_regions');
      console.log('[MousePassthrough] 已清除所有区域限制');
      return true;
    } catch (error) {
      console.error('[MousePassthrough] 清除区域失败:', error);
      return false;
    }
  }

  /**
   * 从 DOM 元素自动计算交互区域
   * @param {Array<string>} selectors - CSS 选择器数组
   * @returns {Array<{x: number, y: number, width: number, height: number}>}
   * 
   * @example
   * const regions = MousePassthroughAPI.getRegionsFromElements([
   *   '.sn-floating-button',
   *   '.sn-toolbar-button'
   * ]);
   */
  static getRegionsFromElements(selectors) {
    const regions = [];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          regions.push({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          });
        }
      });
    });

    return regions;
  }

  /**
   * 自动设置 UI 元素为可交互区域
   * @param {Array<string>} selectors - CSS 选择器数组
   * 
   * @example
   * await MousePassthroughAPI.setInteractiveElementsBySelectors([
   *   '.sn-floating-button',
   *   '.sn-toolbar-button',
   *   '.sn-settings-modal'
   * ]);
   */
  static async setInteractiveElementsBySelectors(selectors) {
    const regions = this.getRegionsFromElements(selectors);
    return await this.setInteractiveRegions(regions);
  }
}

export default MousePassthroughAPI;
