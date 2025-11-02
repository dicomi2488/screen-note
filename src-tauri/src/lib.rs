mod mouse_passthrough;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        mouse_passthrough::enable_mouse_passthrough,
        mouse_passthrough::disable_mouse_passthrough,
        mouse_passthrough::toggle_mouse_passthrough,
        mouse_passthrough::set_interactive_regions,
        mouse_passthrough::clear_interactive_regions,
        mouse_passthrough::get_window_style_info,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}



