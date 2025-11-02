// 鼠标透传 API - 基于 Windows API
use tauri::{Runtime, Window};
use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::HWND,
    Graphics::Gdi::{CreateEllipticRgn, SetWindowRgn, CombineRgn, RGN_OR, DeleteObject},
    UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, 
        GWL_EXSTYLE, WS_EX_TRANSPARENT, WS_EX_LAYERED,
        SWP_FRAMECHANGED, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_NOACTIVATE,
        HWND_TOPMOST,
    },
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractiveRegion {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// 启用全窗口鼠标透传
#[tauri::command]
pub fn enable_mouse_passthrough<R: Runtime>(window: Window<R>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};

        match window.window_handle() {
            Ok(handle) => {
                if let RawWindowHandle::Win32(win32_handle) = handle.as_raw() {
                    unsafe {
                        let hwnd = HWND(win32_handle.hwnd.get());
                        
                        // 获取当前样式
                        let old_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                        log::info!("[MousePassthrough] 启用前样式: 0x{:X}", old_style);
                        
                        let mut style = old_style;
                        
                        // 确保有 WS_EX_LAYERED（透明窗口必需）
                        if (style & WS_EX_LAYERED.0 as isize) == 0 {
                            style |= WS_EX_LAYERED.0 as isize;
                            log::info!("[MousePassthrough] 添加 WS_EX_LAYERED");
                        }
                        
                        // 添加 WS_EX_TRANSPARENT（鼠标透传）
                        style |= WS_EX_TRANSPARENT.0 as isize;
                        
                        // 应用新样式
                        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);
                        
                        let new_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                        log::info!("[MousePassthrough] 启用后样式: 0x{:X}", new_style);
                        
                        // 强制窗口更新以应用新样式
                        let pos_result = SetWindowPos(
                            hwnd,
                            HWND_TOPMOST,
                            0, 0, 0, 0,
                            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
                        );
                        
                        if pos_result.is_err() {
                            log::warn!("[MousePassthrough] SetWindowPos 返回错误: {:?}", pos_result);
                        }
                        
                        log::info!("[MousePassthrough] 鼠标透传已启用");
                    }
                    Ok(())
                } else {
                    Err("Not a Windows window".to_string())
                }
            }
            Err(e) => Err(format!("Failed to get window handle: {}", e))
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    Err("Only supported on Windows".to_string())
}

/// 禁用鼠标透传（恢复正常交互）
#[tauri::command]
pub fn disable_mouse_passthrough<R: Runtime>(window: Window<R>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};

        match window.window_handle() {
            Ok(handle) => {
                if let RawWindowHandle::Win32(win32_handle) = handle.as_raw() {
                    unsafe {
                        let hwnd = HWND(win32_handle.hwnd.get());
                        
                        // 获取当前样式
                        let mut style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                        
                        // 移除 WS_EX_TRANSPARENT（恢复鼠标交互）
                        style &= !(WS_EX_TRANSPARENT.0 as isize);
                        
                        // 应用新样式
                        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);
                        
                        // 强制窗口更新
                        let _ = SetWindowPos(
                            hwnd,
                            HWND_TOPMOST,
                            0, 0, 0, 0,
                            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
                        );
                        
                        log::info!("[MousePassthrough] 鼠标透传已禁用");
                    }
                    Ok(())
                } else {
                    Err("Not a Windows window".to_string())
                }
            }
            Err(e) => Err(format!("Failed to get window handle: {}", e))
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    Err("Only supported on Windows".to_string())
}

/// 切换鼠标透传状态
#[tauri::command]
pub fn toggle_mouse_passthrough<R: Runtime>(window: Window<R>, enabled: bool) -> Result<(), String> {
    if enabled {
        enable_mouse_passthrough(window)
    } else {
        disable_mouse_passthrough(window)
    }
}

/// 设置可交互区域（只有这些区域可以点击，其他区域透传）
#[tauri::command]
pub fn set_interactive_regions<R: Runtime>(
    window: Window<R>,
    regions: Vec<InteractiveRegion>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};

        match window.window_handle() {
            Ok(handle) => {
                if let RawWindowHandle::Win32(win32_handle) = handle.as_raw() {
                    unsafe {
                        let hwnd = HWND(win32_handle.hwnd.get());
                        
                        if regions.is_empty() {
                            // 清除区域，恢复完整窗口（全透传）
                            SetWindowRgn(hwnd, None, true);
                            
                            // 同时设置透传样式
                            let mut style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                            style |= WS_EX_TRANSPARENT.0 as isize;
                            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);
                            
                            // 强制更新
                            let _ = SetWindowPos(
                                hwnd,
                                HWND_TOPMOST,
                                0, 0, 0, 0,
                                SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
                            );
                        } else {
                            // 禁用透传样式（因为我们用 Region 控制）
                            let mut style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                            style &= !(WS_EX_TRANSPARENT.0 as isize);
                            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);
                            
                            // 创建第一个区域（圆形/椭圆形）
                            let first_region = CreateEllipticRgn(
                                regions[0].x,
                                regions[0].y,
                                regions[0].x + regions[0].width,
                                regions[0].y + regions[0].height,
                            );
                            
                            if first_region.is_invalid() {
                                return Err("Failed to create first region".to_string());
                            }

                            let combined_region = first_region;

                            // 合并其他区域（圆形/椭圆形）
                            for region in regions.iter().skip(1) {
                                let new_region = CreateEllipticRgn(
                                    region.x,
                                    region.y,
                                    region.x + region.width,
                                    region.y + region.height,
                                );
                                
                                if !new_region.is_invalid() {
                                    CombineRgn(combined_region, combined_region, new_region, RGN_OR);
                                    DeleteObject(new_region);
                                }
                            }

                            // 应用到窗口（true = 重绘）
                            SetWindowRgn(hwnd, combined_region, true);
                            // Region 会被系统接管，不需要手动 DeleteObject
                            
                            // 强制更新窗口
                            let _ = SetWindowPos(
                                hwnd,
                                HWND_TOPMOST,
                                0, 0, 0, 0,
                                SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
                            );
                        }
                    } // unsafe 块结束
                    Ok(())
                } else {
                    Err("Not a Windows window".to_string())
                }
            }
            Err(e) => Err(format!("Failed to get window handle: {}", e))
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    Err("Only supported on Windows".to_string())
}

/// 清除所有交互区域限制（恢复正常全窗口交互）
#[tauri::command]
pub fn clear_interactive_regions<R: Runtime>(window: Window<R>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};

        match window.window_handle() {
            Ok(handle) => {
                if let RawWindowHandle::Win32(win32_handle) = handle.as_raw() {
                    unsafe {
                        let hwnd = HWND(win32_handle.hwnd.get());
                        
                        // 清除 Region
                        SetWindowRgn(hwnd, None, true);
                        
                        // 恢复正常交互（禁用透传）
                        let mut style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                        style &= !(WS_EX_TRANSPARENT.0 as isize);
                        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);
                        
                        // 强制更新
                        let _ = SetWindowPos(
                            hwnd,
                            HWND_TOPMOST,
                            0, 0, 0, 0,
                            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
                        );
                    }
                    Ok(())
                } else {
                    Err("Not a Windows window".to_string())
                }
            }
            Err(e) => Err(format!("Failed to get window handle: {}", e))
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    Err("Only supported on Windows".to_string())
}

/// 获取当前窗口样式信息（用于调试）
#[tauri::command]
pub fn get_window_style_info<R: Runtime>(window: Window<R>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};

        match window.window_handle() {
            Ok(handle) => {
                if let RawWindowHandle::Win32(win32_handle) = handle.as_raw() {
                    unsafe {
                        let hwnd = HWND(win32_handle.hwnd.get());
                        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                        
                        let has_layered = (style & WS_EX_LAYERED.0 as isize) != 0;
                        let has_transparent = (style & WS_EX_TRANSPARENT.0 as isize) != 0;
                        
                        let info = format!(
                            "窗口样式 (GWL_EXSTYLE): 0x{:X}\n\
                             - WS_EX_LAYERED (透明支持): {}\n\
                             - WS_EX_TRANSPARENT (鼠标透传): {}\n\
                             - HWND: {:?}",
                            style,
                            if has_layered { "✅ 已启用" } else { "❌ 未启用" },
                            if has_transparent { "✅ 已启用" } else { "❌ 未启用" },
                            hwnd
                        );
                        
                        log::info!("[StyleInfo]\n{}", info);
                        Ok(info)
                    }
                } else {
                    Err("Not a Windows window".to_string())
                }
            }
            Err(e) => Err(format!("Failed to get window handle: {}", e))
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    Err("Only supported on Windows".to_string())
}
