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
/// 이 값보다 낮은 원격 캐시는 무시하고 앱에 내장된 레시피를 쓴다.
///
/// **앱 릴리스가 내장 레시피를 바꿨다면 반드시 (게시된 최신 bundleVersion + 1)로 올린다.**
/// 안 올리면 사용자 기기에 남아 있는 낡은 캐시가 새 내장 레시피를 이겨서 수정이 안 켜진다.
/// 번들을 게시한 뒤에는 `min <= 게시 버전` 상태로 수렴시킨다(계속 앞질러 두면 원격 갱신을 통째로 무시하게 된다).
///
/// 3 = v0.1.5의 openclaw rollback·onboard 교체분. 게시 번들은 아직 1이다.
const BUNDLED_MIN_VERSION: u64 = 3;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // GUI로 켠 앱은 PATH가 좁아 사용자가 이미 깔아둔 도구를 못 찾는다.
            // 로그인 셸에서 PATH를 구해 오는데 프로필이 느리면 몇 초가 걸리므로,
            // 웹뷰가 뜨는 동안 백그라운드로 미리 데워 첫 화면이 기다리지 않게 한다.
            runner::process::prewarm_login_shell_path();
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
                pty_masters: std::sync::Arc::new(Mutex::new(HashMap::new())),
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
            commands::pty_resize,
            commands::export_diagnostics,
        ])
        .run(tauri::generate_context!())
        .expect("이지 하네스 실행 실패");
}
