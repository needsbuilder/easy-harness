pub mod commands;
pub mod error;
pub mod probe;
pub mod recipe;
pub mod runner;
pub mod state;

use std::collections::HashMap;
use std::sync::atomic::AtomicU64;
use std::sync::Mutex;

use tauri::Manager;

use commands::AppContext;
use recipe::loader::Catalog;
use state::StateStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let bundled = app
                .path()
                .resource_dir()
                .map(|d| d.join("recipes"))
                .ok()
                .filter(|d| {
                    std::fs::read_dir(d)
                        .map(|mut e| e.next().is_some())
                        .unwrap_or(false)
                })
                .unwrap_or_else(Catalog::bundled_dir);
            let catalog = Catalog::load_dir(&bundled).expect("번들 레시피 로딩 실패");
            let data_dir = app.path().app_data_dir()?;
            let store = StateStore::new(data_dir.join("installed.json"));
            app.manage(AppContext {
                catalog,
                store,
                runs: Mutex::new(HashMap::new()),
                run_seq: AtomicU64::new(1),
                pty_inputs: std::sync::Arc::new(Mutex::new(HashMap::new())),
                run_logs: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_env_report,
            commands::list_catalog,
            commands::get_dry_run,
            commands::get_app_state,
            commands::provide_secret,
            commands::start_flow,
            commands::pty_input,
            commands::export_diagnostics,
        ])
        .run(tauri::generate_context!())
        .expect("이지 하네스 실행 실패");
}
