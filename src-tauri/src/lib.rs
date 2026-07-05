pub mod commands;
pub mod error;
pub mod probe;
pub mod recipe;
pub mod runner;
pub mod state;

use std::collections::HashMap;
use std::sync::atomic::AtomicU64;
use std::sync::Mutex;

use tauri::{Emitter, Manager};

use commands::AppContext;
use recipe::loader::Catalog;
use state::StateStore;

/// 번들 리소스보다 낮은 버전의 원격 캐시는 무시하고 번들로 폴백한다.
const BUNDLED_MIN_VERSION: u64 = 1;

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
            let data_dir = app.path().app_data_dir()?;
            let cache_dir = data_dir.join("recipes-cache");
            let catalog = recipe::remote::load_cached(&cache_dir, BUNDLED_MIN_VERSION)
                .unwrap_or_else(|| Catalog::load_dir(&bundled).expect("번들 레시피 로딩 실패"));
            let store = StateStore::new(data_dir.join("installed.json"));
            app.manage(AppContext {
                catalog,
                store,
                runs: Mutex::new(HashMap::new()),
                run_seq: AtomicU64::new(1),
                pty_inputs: std::sync::Arc::new(Mutex::new(HashMap::new())),
                run_logs: Mutex::new(HashMap::new()),
            });

            // 백그라운드 원격 갱신: 네트워크 없음·404 등은 조용히 무시(레시피 저장소가 아직 없음).
            // 갱신 성공분은 다음 실행부터 반영, 이번 실행은 catalog://updated로 프론트에만 알린다.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if recipe::remote::refresh(recipe::remote::REMOTE_BASE, &cache_dir)
                    .await
                    .unwrap_or(false)
                {
                    let _ = handle.emit("catalog://updated", &());
                }
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
