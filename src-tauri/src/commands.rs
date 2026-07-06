use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::mpsc;

use crate::error::EngineError;
use crate::probe::{probe_env, EnvReport};
use crate::recipe::loader::Catalog;
use crate::recipe::plan::{build_plan, Flow};
use crate::recipe::schema::Platform;
use crate::runner::dry_run::{dry_run, DryRunReport};
use crate::runner::events::{ProgressEmitter, ProgressEvent, StepStatus};
use crate::runner::process::TokioProcessRunner;
use crate::runner::pty::{PortablePtyRunner, PtyInputRegistry};
use crate::runner::secrets::SecretVault;
use crate::runner::step_runner::{run_plan, RunDeps};
use crate::runner::UrlOpener;
use crate::state::{now_unix, AppState, Installation, StateStore};

/// 앱 전역 상태 (lib.rs에서 .manage()로 등록)
pub struct AppContext {
    pub catalog: Catalog,
    pub store: StateStore,
    pub runs: Mutex<HashMap<String, mpsc::Sender<(String, String)>>>,
    pub run_seq: AtomicU64,
    pub pty_inputs: PtyInputRegistry,
    pub pty_masters: crate::runner::pty::PtyMasterRegistry,
    pub run_logs: Mutex<HashMap<String, Vec<String>>>,
}

impl AppContext {
    pub fn store_path(&self) -> std::path::PathBuf {
        self.store.path().to_path_buf()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub easy_description: String,
    pub pricing: crate::recipe::schema::Pricing,
    pub supported_models: Vec<crate::recipe::schema::ModelBadge>,
    pub recommended: bool,
    pub requires: Vec<String>,
    pub installed: bool,
    pub installed_version: Option<String>,
    pub missing_requires: Vec<String>,
    pub source: Option<crate::recipe::schema::SourceInfo>,
    pub platforms: Vec<String>,
    pub available: bool,
}

pub fn to_catalog_entries(
    catalog: &Catalog,
    state: &AppState,
    platform: Option<Platform>,
) -> Vec<CatalogEntry> {
    let installed_ids: Vec<&str> = state
        .installations
        .iter()
        .map(|i| i.recipe_id.as_str())
        .collect();
    catalog
        .recipes
        .iter()
        .map(|r| {
            let installation = state.installations.iter().find(|i| i.recipe_id == r.id);
            CatalogEntry {
                id: r.id.clone(),
                name: r.name.clone(),
                kind: r.kind.as_str().to_string(),
                easy_description: r.easy_description.clone(),
                pricing: r.pricing.clone(),
                supported_models: r.supported_models.clone(),
                recommended: r.recommended,
                requires: r.requires.clone(),
                installed: installation.is_some(),
                installed_version: installation.and_then(|i| i.version.clone()),
                missing_requires: r
                    .requires
                    .iter()
                    .filter(|id| !installed_ids.contains(&id.as_str()))
                    .cloned()
                    .collect(),
                source: r.source.clone(),
                platforms: {
                    let mut v = Vec::new();
                    if r.platforms.mac.is_some() {
                        v.push("mac".to_string());
                    }
                    if r.platforms.windows.is_some() {
                        v.push("windows".to_string());
                    }
                    v
                },
                available: platform.is_some_and(|p| r.platforms.get(p).is_some()),
            }
        })
        .collect()
}

fn current_platform() -> Result<Platform, String> {
    Platform::current().ok_or_else(|| "지원하지 않는 운영체제예요".to_string())
}

fn err_str(e: EngineError) -> String {
    e.to_string()
}

struct TauriEmitter {
    app: AppHandle,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LogPayload {
    run_id: String,
    line: String,
}

impl ProgressEmitter for TauriEmitter {
    fn progress(&self, ev: &ProgressEvent) {
        let _ = self.app.emit("install://progress", ev);
    }
    fn log(&self, run_id: &str, line: &str) {
        if let Some(ctx) = self.app.try_state::<AppContext>() {
            let mut logs = ctx.run_logs.lock().unwrap();
            let entry = logs.entry(run_id.to_string()).or_default();
            entry.push(line.to_string());
            let len = entry.len();
            if len > 2000 {
                entry.drain(0..len - 2000);
            }
        }
        let _ = self.app.emit(
            "install://log",
            &LogPayload {
                run_id: run_id.to_string(),
                line: line.to_string(),
            },
        );
    }
}

struct PluginUrlOpener {
    app: AppHandle,
}

impl UrlOpener for PluginUrlOpener {
    fn open(&self, url: &str) -> Result<(), String> {
        // 프론트 권한 체계(capabilities)는 안 타지만, 백엔드 네이티브 코드라
        // opener 플러그인 인스턴스(self.app.opener())로 여는 것과 동작 동일.
        // 필드를 실제로 사용해 dead_code 경고도 해결.
        self.app
            .opener()
            .open_url(url, None::<String>)
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn get_env_report() -> EnvReport {
    probe_env(&TokioProcessRunner).await
}

#[tauri::command]
pub fn list_catalog(ctx: State<'_, AppContext>) -> Vec<CatalogEntry> {
    to_catalog_entries(&ctx.catalog, &ctx.store.load(), Platform::current())
}

#[tauri::command]
pub fn get_dry_run(tool_id: String, ctx: State<'_, AppContext>) -> Result<DryRunReport, String> {
    let platform = current_platform()?;
    let installed: Vec<String> = ctx
        .store
        .load()
        .installations
        .iter()
        .map(|i| i.recipe_id.clone())
        .collect();
    dry_run(&ctx.catalog, &tool_id, platform, &installed).map_err(err_str)
}

#[tauri::command]
pub fn get_app_state(ctx: State<'_, AppContext>) -> AppState {
    ctx.store.load()
}

#[tauri::command]
pub fn provide_secret(
    run_id: String,
    label: String,
    value: String,
    ctx: State<'_, AppContext>,
) -> Result<(), String> {
    let sender = ctx
        .runs
        .lock()
        .unwrap()
        .get(&run_id)
        .cloned()
        .ok_or_else(|| "진행 중인 작업을 찾지 못했어요".to_string())?;
    sender.try_send((label, value)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_input(
    session_id: String,
    data: String,
    ctx: State<'_, AppContext>,
) -> Result<(), String> {
    let mut inputs = ctx.pty_inputs.lock().unwrap();
    let writer = inputs
        .get_mut(&session_id)
        .ok_or_else(|| "터미널 세션을 찾지 못했어요".to_string())?;
    writer
        .write_all(data.as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_resize(session_id: String, cols: u16, rows: u16, ctx: State<'_, AppContext>) {
    // 프런트 fit 결과가 비정상 값이어도 PTY가 망가지지 않게 방어적으로 자른다.
    // 세션이 이미 끝났으면 false가 돌아오지만 에러는 아니다 (fit과 종료의 경쟁).
    let _ = crate::runner::pty::resize_master(
        &ctx.pty_masters,
        &session_id,
        cols.clamp(20, 500),
        rows.clamp(5, 200),
    );
}

#[tauri::command]
pub async fn export_diagnostics(
    app: AppHandle,
    ctx: State<'_, AppContext>,
) -> Result<String, String> {
    let env = probe_env(&TokioProcessRunner).await;
    let env_json = serde_json::to_string_pretty(&env).map_err(|e| e.to_string())?;
    let state_json = serde_json::to_string_pretty(&ctx.store.load()).map_err(|e| e.to_string())?;
    let logs: Vec<(String, Vec<String>)> = ctx
        .run_logs
        .lock()
        .unwrap()
        .iter()
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let dest = dir.join(format!(
        "easy-harness-diagnostics-{}.zip",
        crate::state::now_unix()
    ));
    crate::runner::diagnostics::build_zip(&dest, &env_json, &state_json, &logs)
        .map_err(|e| e.to_string())?;
    let _ = app.opener().reveal_item_in_dir(&dest);
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn start_flow(
    tool_id: String,
    flow: String,
    demo: bool,
    app: AppHandle,
    ctx: State<'_, AppContext>,
) -> Result<String, String> {
    let platform = current_platform()?;
    let flow = match flow.as_str() {
        "install" => Flow::Install,
        "update" => Flow::Update,
        "uninstall" => Flow::Uninstall,
        other => return Err(format!("모르는 작업이에요: {other}")),
    };
    let installed: Vec<String> = ctx
        .store
        .load()
        .installations
        .iter()
        .map(|i| i.recipe_id.clone())
        .collect();
    let plan = build_plan(&ctx.catalog, &tool_id, platform, flow, &installed).map_err(err_str)?;

    let run_id = format!("run-{}", ctx.run_seq.fetch_add(1, Ordering::Relaxed));
    let (tx, mut rx) = mpsc::channel::<(String, String)>(4);
    ctx.runs.lock().unwrap().insert(run_id.clone(), tx);

    let catalog = ctx.catalog.clone();
    let store_path = ctx.store_path();
    let id_for_task = run_id.clone();
    let ctx_inputs = ctx.pty_inputs.clone();
    let ctx_masters = ctx.pty_masters.clone();
    tauri::async_runtime::spawn(async move {
        let emitter = TauriEmitter { app: app.clone() };
        let success = if demo {
            run_demo(&plan, &id_for_task, &emitter).await
        } else {
            let process = TokioProcessRunner;
            let opener = PluginUrlOpener { app: app.clone() };
            let downloader = crate::runner::download::ReqwestDownloader;
            let pty = PortablePtyRunner {
                app: app.clone(),
                inputs: ctx_inputs.clone(),
                masters: ctx_masters.clone(),
            };
            let deps = RunDeps {
                process: &process,
                emitter: &emitter,
                opener: &opener,
                downloader: &downloader,
                pty: &pty,
                vault: SecretVault::new(),
            };
            run_plan(&plan, &catalog, platform, &id_for_task, deps, &mut rx)
                .await
                .success
        };
        if success && !demo {
            let store = StateStore::new(store_path);
            match flow {
                Flow::Install | Flow::Update => {
                    let target_version =
                        probe_version_for(&catalog, &plan.target_id, platform).await;
                    let _ = store.upsert(Installation {
                        recipe_id: plan.target_id.clone(),
                        version: target_version,
                        installed_at: now_unix(),
                        auth_done: true,
                        verified_at: Some(now_unix()),
                    });
                    // 의존성으로 함께 설치된 도구들도 기록
                    for id in &plan.tool_order {
                        if id != &plan.target_id {
                            let dep_version = probe_version_for(&catalog, id, platform).await;
                            let _ = store.upsert(Installation {
                                recipe_id: id.clone(),
                                version: dep_version,
                                installed_at: now_unix(),
                                auth_done: false,
                                verified_at: Some(now_unix()),
                            });
                        }
                    }
                }
                Flow::Uninstall => {
                    let _ = store.remove(&plan.target_id);
                }
            }
        }
        if let Some(ctx) = app.try_state::<AppContext>() {
            ctx.runs.lock().unwrap().remove(&id_for_task);
        }
    });
    Ok(run_id)
}

/// M2 시연용: 실행 없이 진행 이벤트만 스텝당 400ms 간격으로 흘린다
async fn run_demo(
    plan: &crate::recipe::plan::InstallPlan,
    run_id: &str,
    emitter: &impl ProgressEmitter,
) -> bool {
    let total = plan.steps.len();
    for (i, planned) in plan.steps.iter().enumerate() {
        let base = ProgressEvent {
            run_id: run_id.to_string(),
            recipe_id: planned.recipe_id.clone(),
            recipe_name: planned.recipe_name.clone(),
            section: planned.section.as_str().to_string(),
            step_index: i,
            total_steps: total,
            friendly: planned.step.friendly().to_string(),
            status: StepStatus::Running,
        };
        emitter.progress(&base);
        emitter.log(run_id, &format!("[시연] {}", planned.step.friendly()));
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        emitter.progress(&ProgressEvent {
            status: StepStatus::Succeeded,
            ..base.clone()
        });
    }
    emitter.progress(&ProgressEvent {
        run_id: run_id.to_string(),
        recipe_id: plan.target_id.clone(),
        recipe_name: String::new(),
        section: "done".into(),
        step_index: total,
        total_steps: total,
        friendly: "모두 끝났어요".into(),
        status: StepStatus::Done { success: true },
    });
    true
}

/// 레시피의 detect 첫 check_command를 버전 조사 명령으로 쓴다 (없으면 None → 날짜만 표시).
/// command/args의 "{{home}}"은 실제 실행 경로(runner)와 동일하게 expand_home으로 치환해 반환한다.
fn version_probe_command(
    catalog: &crate::recipe::loader::Catalog,
    id: &str,
    platform: Platform,
) -> Option<(String, Vec<String>)> {
    let spec = catalog.get(id)?.platforms.get(platform)?;
    spec.detect.iter().find_map(|s| match s {
        crate::recipe::schema::Step::CheckCommand { command, args, .. } => Some((
            crate::runner::expand_home(command),
            args.iter().map(|a| crate::runner::expand_home(a)).collect(),
        )),
        _ => None,
    })
}

async fn probe_version_for(
    catalog: &crate::recipe::loader::Catalog,
    id: &str,
    platform: Platform,
) -> Option<String> {
    let (cmd, args) = version_probe_command(catalog, id, platform)?;
    crate::probe::probe_tool_version(&TokioProcessRunner, &cmd, &args).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::loader::Catalog;
    use crate::state::{AppState, Installation};

    #[test]
    fn catalog_entries_carry_install_state_and_missing_requires() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let state = AppState {
            installations: vec![Installation {
                recipe_id: "mock-prereq".into(),
                version: Some("0.1.0".into()),
                installed_at: 1,
                auth_done: true,
                verified_at: Some(2),
            }],
        };
        let entries = to_catalog_entries(&catalog, &state, Some(Platform::Mac));
        let prereq = entries.iter().find(|e| e.id == "mock-prereq").unwrap();
        assert!(prereq.installed);
        assert_eq!(prereq.installed_version.as_deref(), Some("0.1.0"));
        let plugin = entries.iter().find(|e| e.id == "mock-plugin").unwrap();
        assert!(!plugin.installed);
        assert_eq!(plugin.missing_requires, vec!["mock-tool"]); // mock-tool 미설치라 경고 배지감
    }

    #[test]
    fn entries_expose_platform_availability() {
        let mut catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        // mock-tool을 맥 전용으로 조작
        catalog
            .recipes
            .iter_mut()
            .find(|r| r.id == "mock-tool")
            .unwrap()
            .platforms
            .windows = None;
        let state = AppState {
            installations: vec![],
        };
        let on_win = to_catalog_entries(
            &catalog,
            &state,
            Some(crate::recipe::schema::Platform::Windows),
        );
        let tool = on_win.iter().find(|e| e.id == "mock-tool").unwrap();
        assert_eq!(tool.platforms, vec!["mac"]);
        assert!(!tool.available);
        let on_mac =
            to_catalog_entries(&catalog, &state, Some(crate::recipe::schema::Platform::Mac));
        assert!(
            on_mac
                .iter()
                .find(|e| e.id == "mock-tool")
                .unwrap()
                .available
        );
        // OS 판별 불가(None)면 전부 비가용
        let unknown = to_catalog_entries(&catalog, &state, None);
        assert!(unknown.iter().all(|e| !e.available));
    }

    #[test]
    fn progress_event_serializes_camel_case_with_kind_tag() {
        use crate::runner::events::{ProgressEvent, StepStatus};
        let ev = ProgressEvent {
            run_id: "run-1".into(),
            recipe_id: "mock-tool".into(),
            recipe_name: "모의 도구".into(),
            section: "install".into(),
            step_index: 2,
            total_steps: 8,
            friendly: "설치 중".into(),
            status: StepStatus::WaitingSecret {
                label: "api_key".into(),
            },
        };
        let json = serde_json::to_string(&ev).unwrap();
        assert!(json.contains("\"runId\":\"run-1\""));
        assert!(json.contains("\"stepIndex\":2"));
        assert!(json.contains("\"totalSteps\":8"));
        assert!(json.contains("\"status\":{\"kind\":\"waitingSecret\",\"label\":\"api_key\"}"));
    }

    #[test]
    fn version_probe_command_uses_first_detect_check() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        let (cmd, _args) = version_probe_command(&catalog, "claude-code", Platform::Mac)
            .expect("claude-code mac detect에 check_command 있어야 함");
        assert!(!cmd.is_empty());
    }

    #[test]
    fn version_probe_command_expands_home_template() {
        // gajaecode mac detect의 command는 "{{home}}/.bun/bin/gjc" 형태 (raw 그대로면 실행 불가).
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        let (cmd, _args) = version_probe_command(&catalog, "gajaecode", Platform::Mac)
            .expect("gajaecode mac detect에 check_command 있어야 함");
        assert!(!cmd.contains("{{"), "치환 안 된 템플릿 남음: {cmd}");
        // 홈 경로는 OS마다 다르므로(맥 "/Users/..." vs 윈도우 "C:\Users\...") 하드코딩 대신
        // runner::home_dir()로 기대값을 동적 계산 (runner::tests::home_placeholder_is_expanded_in_command_and_args 관례)
        let home = crate::runner::home_dir();
        assert!(
            cmd.starts_with(&home),
            "홈 경로({home})로 치환된 경로여야 함: {cmd}"
        );
    }
}
