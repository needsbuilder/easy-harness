use tokio::sync::mpsc::Receiver;

use crate::recipe::loader::Catalog;
use crate::recipe::plan::{InstallPlan, PlannedStep, Section};
use crate::recipe::schema::Platform;
use crate::runner::download::Downloader;
use crate::runner::events::{ProgressEmitter, ProgressEvent, StepStatus};
use crate::runner::process::ProcessRunner;
use crate::runner::pty::PtyRunner;
use crate::runner::secrets::SecretVault;
use crate::runner::{execute_step, StepOutcome, UrlOpener};

pub struct RunDeps<
    'a,
    P: ProcessRunner,
    E: ProgressEmitter,
    O: UrlOpener,
    D: Downloader,
    Y: PtyRunner,
> {
    pub process: &'a P,
    pub emitter: &'a E,
    pub opener: &'a O,
    pub downloader: &'a D,
    pub pty: &'a Y,
    pub vault: SecretVault,
}

pub struct RunReport {
    pub success: bool,
    pub failed_step: Option<ProgressEvent>,
    /// install 섹션까지 끝낸 도구 목록.
    ///
    /// **현재 프로덕션(commands.rs)은 이 값을 쓰지 않는다.** 실패한 런의 결과를
    /// `installed.json`에 기록해 보려다 되돌렸다: 기록은 단순 메모가 아니라 다음 계획의
    /// 입력이라서(`plan.rs`가 installed된 의존 도구를 서브트리째 건너뛴다), 로그인이
    /// 실패한 도구를 "설치됨"으로 남기면 재시도에서 그 도구의 auth 스텝이 영구히
    /// 생략되고 "모두 끝났어요"가 뜬다. 터미널을 못 쓰는 사용자에게는 복구 불가다
    /// (2026-07-25 릴리스 관문 리뷰).
    ///
    /// 그래서 "install은 끝났는데 인증이 실패한 도구가 대시보드에 안 보이는 문제"는
    /// 아직 열려 있다. 되살릴 때는 auth 섹션이 없는 도구(준비물)로 한정하거나,
    /// installed.json과 계획 입력을 분리해야 한다. 테스트가 이 값을 검증하고 있다.
    pub installed_tools: Vec<String>,
}

/// `before` 인덱스 앞까지 진행됐을 때 install 섹션을 끝낸 도구 목록.
/// 실패는 런을 즉시 중단시키므로, 실패 지점보다 앞의 스텝은 전부 성공한 것이다.
fn tools_with_completed_install(plan: &InstallPlan, before: usize) -> Vec<String> {
    plan.tool_order
        .iter()
        .filter(|id| {
            let mut has_install = false;
            for (idx, s) in plan.steps.iter().enumerate() {
                if &s.recipe_id == *id && matches!(s.section, Section::Install) {
                    has_install = true;
                    if idx >= before {
                        return false;
                    }
                }
            }
            has_install
        })
        .cloned()
        .collect()
}

pub async fn run_plan<
    P: ProcessRunner,
    E: ProgressEmitter,
    O: UrlOpener,
    D: Downloader,
    Y: PtyRunner,
>(
    plan: &InstallPlan,
    catalog: &Catalog,
    platform: Platform,
    run_id: &str,
    mut deps: RunDeps<'_, P, E, O, D, Y>,
    secret_rx: &mut Receiver<(String, String)>,
) -> RunReport {
    let total = plan.steps.len();

    // Done 이벤트는 성공·실패 관계없이 항상 step_index == total_steps로 보낸다.
    // 프론트 진행바는 step_index/total_steps로 퍼센트를 계산하므로, 종료 신호는
    // 늘 100%를 가리켜야 한다 (실패로 중단된 스텝의 인덱스를 쓰면 진행바가 중간에 멈춰 보인다).
    let done = |success: bool, friendly: &str| ProgressEvent {
        run_id: run_id.to_string(),
        recipe_id: plan.target_id.clone(),
        recipe_name: String::new(),
        section: "done".to_string(),
        step_index: total,
        total_steps: total,
        friendly: friendly.to_string(),
        status: StepStatus::Done { success },
    };

    for (i, planned) in plan.steps.iter().enumerate() {
        let ev = |status: StepStatus| ProgressEvent {
            run_id: run_id.to_string(),
            recipe_id: planned.recipe_id.clone(),
            recipe_name: planned.recipe_name.clone(),
            section: planned.section.as_str().to_string(),
            step_index: i,
            total_steps: total,
            friendly: planned.step.friendly().to_string(),
            status,
        };
        deps.emitter.progress(&ev(StepStatus::Running));
        if let crate::recipe::schema::Step::PtySession { command, args, .. } = &planned.step {
            let session_id = format!("{run_id}-pty-{i}");
            deps.emitter.progress(&ev(StepStatus::Terminal {
                session_id: session_id.clone(),
            }));
            let command = crate::runner::expand_home(&deps.vault.substitute(command));
            let args: Vec<String> = args
                .iter()
                .map(|a| crate::runner::expand_home(&deps.vault.substitute(a)))
                .collect();
            match deps.pty.run(&session_id, &command, &args).await {
                Ok(0) => {
                    deps.emitter.progress(&ev(StepStatus::Succeeded));
                    continue;
                }
                Ok(code) => {
                    deps.emitter.log(
                        run_id,
                        &deps.vault.mask(&format!("터미널 세션 종료 코드 {code}")),
                    );
                    let failed = ev(StepStatus::Failed {
                        message: "로그인이 끝까지 진행되지 않았어요. 다시 시도해 볼까요?".into(),
                    });
                    deps.emitter.progress(&failed);
                    rollback(planned, catalog, platform, run_id, &deps).await;
                    deps.emitter
                        .progress(&done(false, "설치를 마치지 못했어요"));
                    return RunReport {
                        success: false,
                        failed_step: Some(failed),
                        installed_tools: tools_with_completed_install(plan, i),
                    };
                }
                Err(e) => {
                    deps.emitter.log(run_id, &deps.vault.mask(&e.to_string()));
                    let failed = ev(StepStatus::Failed {
                        message: "터미널을 열지 못했어요. 다시 시도해 볼까요?".into(),
                    });
                    deps.emitter.progress(&failed);
                    rollback(planned, catalog, platform, run_id, &deps).await;
                    deps.emitter
                        .progress(&done(false, "설치를 마치지 못했어요"));
                    return RunReport {
                        success: false,
                        failed_step: Some(failed),
                        installed_tools: tools_with_completed_install(plan, i),
                    };
                }
            }
        }
        loop {
            let outcome = execute_step(
                &planned.step,
                deps.process,
                &deps.vault,
                deps.opener,
                deps.downloader,
            )
            .await;
            match outcome {
                StepOutcome::Success { log } => {
                    deps.emitter.log(run_id, &log);
                    deps.emitter.progress(&ev(StepStatus::Succeeded));
                    break;
                }
                StepOutcome::Unsupported => {
                    // 아직 미배선 스텝(pty_session, Task 14에서 배선 예정)은 실실행 경로에 오면 실패로 처리
                    let failed = ev(StepStatus::Failed {
                        message: "이 단계는 아직 준비 중이에요.".into(),
                    });
                    deps.emitter.progress(&failed);
                    rollback(planned, catalog, platform, run_id, &deps).await;
                    deps.emitter
                        .progress(&done(false, "설치를 마치지 못했어요"));
                    return RunReport {
                        success: false,
                        failed_step: Some(failed),
                        installed_tools: tools_with_completed_install(plan, i),
                    };
                }
                StepOutcome::NeedsSecret { label, friendly: _ } => {
                    deps.emitter.progress(&ev(StepStatus::WaitingSecret {
                        label: label.clone(),
                    }));
                    match secret_rx.recv().await {
                        Some((l, v)) => {
                            deps.vault.insert(&l, &v);
                            continue;
                        }
                        None => {
                            let failed = ev(StepStatus::Failed {
                                message: "입력이 취소됐어요.".into(),
                            });
                            deps.emitter.progress(&failed);
                            deps.emitter
                                .progress(&done(false, "설치를 마치지 못했어요"));
                            return RunReport {
                                success: false,
                                failed_step: Some(failed),
                                installed_tools: tools_with_completed_install(plan, i),
                            };
                        }
                    }
                }
                StepOutcome::Failure { message, log } => {
                    deps.emitter.log(run_id, &log);
                    if matches!(planned.section, Section::Detect) {
                        // detect 실패 = 미설치. 계속 진행
                        deps.emitter
                            .log(run_id, "설치가 필요해 보여요. 계속 진행할게요.");
                        deps.emitter.progress(&ev(StepStatus::Succeeded));
                        break;
                    }
                    let failed = ev(StepStatus::Failed { message });
                    deps.emitter.progress(&failed);
                    rollback(planned, catalog, platform, run_id, &deps).await;
                    deps.emitter
                        .progress(&done(false, "설치를 마치지 못했어요"));
                    return RunReport {
                        success: false,
                        failed_step: Some(failed),
                        installed_tools: tools_with_completed_install(plan, i),
                    };
                }
            }
        }
    }
    deps.emitter.progress(&done(true, "모두 끝났어요"));
    RunReport {
        success: true,
        failed_step: None,
        installed_tools: tools_with_completed_install(plan, plan.steps.len()),
    }
}

/// 실패한 레시피의 rollback 섹션을 best-effort 실행 (결과는 log로만, 이벤트 없음).
/// 플랜과 같은 platform 인자를 쓴다 — 실행 OS 추측(Platform::current) 금지,
/// 그래야 어느 CI 러너에서든 양쪽 플랫폼 플랜을 테스트할 수 있다.
///
/// install 섹션 실패에만 돈다. rollback의 존재 이유가 "설치하다 만 흔적" 정리인데,
/// auth·verify에 도달했다는 것은 설치 자체는 이미 끝났다는 뜻이라 지울 "흔적"이 없다.
/// 여기서 rollback을 돌리면 멀쩡한 설치물을 지운다. 특히 이미 설치된 도구의 카드를
/// 다시 누른 사용자가 로그인 창을 닫기만 해도(pty 종료코드 != 0) 잘 쓰던 도구가
/// 삭제되던 실사고 경로(2026-07-24 QA 스윕 🔴-1)가 이 게이트로 막힌다.
async fn rollback<
    P: ProcessRunner,
    E: ProgressEmitter,
    O: UrlOpener,
    D: Downloader,
    Y: PtyRunner,
>(
    failed: &PlannedStep,
    catalog: &Catalog,
    platform: Platform,
    run_id: &str,
    deps: &RunDeps<'_, P, E, O, D, Y>,
) {
    if !matches!(failed.section, Section::Install) {
        return;
    }
    let Some(spec) = catalog
        .get(&failed.recipe_id)
        .and_then(|r| r.platforms.get(platform))
    else {
        return;
    };
    for step in &spec.rollback {
        deps.emitter
            .log(run_id, &format!("정리 중: {}", step.friendly()));
        let _ = execute_step(
            step,
            deps.process,
            &deps.vault,
            deps.opener,
            deps.downloader,
        )
        .await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::loader::Catalog;
    use crate::recipe::plan::{build_plan, Flow};
    use crate::recipe::schema::Platform;
    use crate::runner::download::FakeDownloader;
    use crate::runner::events::{CollectingEmitter, StepStatus};
    use crate::runner::process::{FakeProcessRunner, ProcessOutput};
    use crate::runner::pty::FakePtyRunner;
    use crate::runner::secrets::SecretVault;
    use crate::runner::FakeUrlOpener;

    fn ok() -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput {
            exit_code: 0,
            stdout: "ok".into(),
            stderr: String::new(),
        })
    }
    fn fail() -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput {
            exit_code: 1,
            stdout: String::new(),
            stderr: "boom".into(),
        })
    }

    fn deps<'a>(
        p: &'a FakeProcessRunner,
        e: &'a CollectingEmitter,
        o: &'a FakeUrlOpener,
        d: &'a FakeDownloader,
        y: &'a FakePtyRunner,
    ) -> RunDeps<
        'a,
        FakeProcessRunner,
        CollectingEmitter,
        FakeUrlOpener,
        FakeDownloader,
        FakePtyRunner,
    > {
        RunDeps {
            process: p,
            emitter: e,
            opener: o,
            downloader: d,
            pty: y,
            vault: SecretVault::new(),
        }
    }

    #[tokio::test]
    async fn happy_path_emits_running_succeeded_done() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let plan = build_plan(&catalog, "mock-tool", Platform::Mac, Flow::Install, &[]).unwrap();
        // 프로세스를 쓰는 스텝은 6개: mock-prereq의 check·run·check 3 + mock-tool의
        // detect check 1, install run_command 1, verify check 1 (path_check·open_url은 프로세스 안 씀)
        let process = FakeProcessRunner::new((0..6).map(|_| ok()).collect());
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let downloader = FakeDownloader::default();
        let pty = FakePtyRunner::default();
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-1",
            deps(&process, &emitter, &opener, &downloader, &pty),
            &mut rx,
        )
        .await;
        assert!(report.success);
        let evs = emitter.events();
        assert!(matches!(
            evs.last().unwrap().status,
            StepStatus::Done { success: true }
        ));
        assert_eq!(
            evs.iter()
                .filter(|e| matches!(e.status, StepStatus::Running))
                .count(),
            plan.steps.len()
        );
        assert_eq!(opener.opened().len(), 1); // auth의 open_url
    }

    #[tokio::test]
    async fn install_failure_triggers_rollback_of_failing_recipe() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let plan = build_plan(&catalog, "mock-prereq", Platform::Mac, Flow::Install, &[]).unwrap();
        // detect ok → install fail → (rollback echo가 이어서 호출됨)
        let process = FakeProcessRunner::new(vec![ok(), fail(), ok()]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let downloader = FakeDownloader::default();
        let pty = FakePtyRunner::default();
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-2",
            deps(&process, &emitter, &opener, &downloader, &pty),
            &mut rx,
        )
        .await;
        assert!(!report.success);
        assert!(report.failed_step.is_some());
        // rollback의 echo까지 3번 호출됐는지
        assert_eq!(process.calls().len(), 3);
        assert!(process.calls()[2].1.join(" ").contains("rollback"));
        // install 자체가 실패했으므로 설치 완료 목록은 비어야 한다
        assert!(report.installed_tools.is_empty());
        assert!(matches!(
            emitter.events().last().unwrap().status,
            StepStatus::Done { success: false }
        ));
    }

    /// verify 실패 = 설치는 이미 끝난 상태. rollback이 돌면 방금 깐(또는 원래 쓰던)
    /// 설치물을 지우므로 절대 돌면 안 된다. 게이트를 지우면 이 테스트가 깨진다.
    #[tokio::test]
    async fn verify_failure_does_not_rollback() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let plan = build_plan(&catalog, "mock-prereq", Platform::Mac, Flow::Install, &[]).unwrap();
        // detect ok → install ok → verify fail. rollback echo가 이어지면 4번째 호출이 생긴다.
        let process = FakeProcessRunner::new(vec![ok(), ok(), fail(), ok()]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let downloader = FakeDownloader::default();
        let pty = FakePtyRunner::default();
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-v",
            deps(&process, &emitter, &opener, &downloader, &pty),
            &mut rx,
        )
        .await;
        assert!(!report.success);
        let calls = process.calls();
        assert_eq!(
            calls.len(),
            3,
            "verify 실패 뒤 rollback이 돌았다: {calls:?}"
        );
        assert!(
            !calls
                .iter()
                .any(|(_, args)| args.join(" ").contains("rollback")),
            "rollback 명령이 실행됨: {calls:?}"
        );
        // install은 끝났으므로 "실재하는 설치"로 보고돼야 한다 (고아 설치 방지).
        assert_eq!(report.installed_tools, vec!["mock-prereq".to_string()]);
    }

    /// 인증 터미널을 닫기만 해도(pty 종료코드 != 0) rollback이 돌아 멀쩡한 설치물을
    /// 지우던 실사고 경로(QA 스윕 🔴-1). auth 섹션 실패는 rollback을 부르면 안 된다.
    #[tokio::test]
    async fn auth_pty_failure_does_not_rollback() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let plan = pty_plan(); // mock-tool의 auth 섹션 pty 스텝 하나
        let process = FakeProcessRunner::new(vec![ok()]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let downloader = FakeDownloader::default();
        let pty = FakePtyRunner::new(vec![Ok(1)]);
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-a",
            deps(&process, &emitter, &opener, &downloader, &pty),
            &mut rx,
        )
        .await;
        assert!(!report.success);
        // mock-tool의 rollback echo가 실행됐다면 process 호출이 남는다.
        assert!(
            process.calls().is_empty(),
            "auth 실패 뒤 rollback이 돌았다: {:?}",
            process.calls()
        );
    }

    #[tokio::test]
    async fn detect_failure_is_not_fatal() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let plan = build_plan(&catalog, "mock-prereq", Platform::Mac, Flow::Install, &[]).unwrap();
        // detect fail(미설치 의미) → install ok → verify ok
        let process = FakeProcessRunner::new(vec![fail(), ok(), ok()]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let downloader = FakeDownloader::default();
        let pty = FakePtyRunner::default();
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-3",
            deps(&process, &emitter, &opener, &downloader, &pty),
            &mut rx,
        )
        .await;
        assert!(report.success);
    }

    #[tokio::test]
    async fn waiting_secret_then_resume() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        // input_secret 스텝을 가진 임시 플랜을 직접 구성
        use crate::recipe::plan::{InstallPlan, PlannedStep, Section};
        use crate::recipe::schema::Step;
        let plan = InstallPlan {
            target_id: "mock-tool".into(),
            tool_order: vec!["mock-tool".into()],
            steps: vec![PlannedStep {
                recipe_id: "mock-tool".into(),
                recipe_name: "모의 도구".into(),
                section: Section::Auth,
                step: Step::InputSecret {
                    friendly: "키를 넣어 주세요".into(),
                    label: "api_key".into(),
                },
            }],
        };
        let process = FakeProcessRunner::new(vec![]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let downloader = FakeDownloader::default();
        let pty = FakePtyRunner::default();
        let (tx, mut rx) = tokio::sync::mpsc::channel(1);
        tx.send(("api_key".to_string(), "sk-1".to_string()))
            .await
            .unwrap();
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-4",
            deps(&process, &emitter, &opener, &downloader, &pty),
            &mut rx,
        )
        .await;
        assert!(report.success);
        assert!(emitter.events().iter().any(
            |e| matches!(&e.status, StepStatus::WaitingSecret { label } if label == "api_key")
        ));
    }

    fn pty_plan() -> InstallPlan {
        use crate::recipe::schema::Step;
        InstallPlan {
            target_id: "mock-tool".into(),
            tool_order: vec!["mock-tool".into()],
            steps: vec![PlannedStep {
                recipe_id: "mock-tool".into(),
                recipe_name: "모의 도구".into(),
                section: Section::Auth,
                step: Step::PtySession {
                    friendly: "로그인을 터미널에서 도와드릴게요".into(),
                    command: "claude".into(),
                    args: vec![],
                },
            }],
        }
    }

    #[tokio::test]
    async fn pty_step_emits_terminal_status_and_succeeds_on_exit_zero() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let plan = pty_plan();
        let process = FakeProcessRunner::new(vec![]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let downloader = crate::runner::download::FakeDownloader::default();
        let pty = FakePtyRunner::new(vec![Ok(0)]);
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let deps = RunDeps {
            process: &process,
            emitter: &emitter,
            opener: &opener,
            downloader: &downloader,
            pty: &pty,
            vault: SecretVault::new(),
        };
        let report = run_plan(&plan, &catalog, Platform::Mac, "run-p", deps, &mut rx).await;
        assert!(report.success);
        let evs = emitter.events();
        assert!(evs.iter().any(
            |e| matches!(&e.status, StepStatus::Terminal { session_id } if session_id == "run-p-pty-0")
        ));
        assert_eq!(
            pty.calls(),
            vec![("run-p-pty-0".to_string(), "claude".to_string())]
        );
    }

    #[tokio::test]
    async fn pty_step_nonzero_exit_fails_run() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let plan = pty_plan();
        let process = FakeProcessRunner::new(vec![]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let downloader = crate::runner::download::FakeDownloader::default();
        let pty = FakePtyRunner::new(vec![Ok(1)]);
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let deps = RunDeps {
            process: &process,
            emitter: &emitter,
            opener: &opener,
            downloader: &downloader,
            pty: &pty,
            vault: SecretVault::new(),
        };
        let report = run_plan(&plan, &catalog, Platform::Mac, "run-p2", deps, &mut rx).await;
        assert!(!report.success);
        let evs = emitter.events();
        assert!(matches!(
            evs.last().unwrap().status,
            StepStatus::Done { success: false }
        ));
    }

    #[tokio::test]
    async fn pty_step_spawn_error_log_is_masked() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let plan = pty_plan();
        let process = FakeProcessRunner::new(vec![]);
        let emitter = CollectingEmitter::default();
        let opener = FakeUrlOpener::default();
        let downloader = crate::runner::download::FakeDownloader::default();
        let secret = "sk-live-abc123";
        let pty = FakePtyRunner::new(vec![Err(std::io::Error::other(format!("boom {secret}")))]);
        let mut vault = SecretVault::new();
        vault.insert("api_key", secret);
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let deps = RunDeps {
            process: &process,
            emitter: &emitter,
            opener: &opener,
            downloader: &downloader,
            pty: &pty,
            vault,
        };
        let report = run_plan(&plan, &catalog, Platform::Mac, "run-p3", deps, &mut rx).await;
        assert!(!report.success);
        let logs = emitter.logs();
        assert!(
            logs.iter().any(|l| l.contains("•••")),
            "masked placeholder should be present in logs: {logs:?}"
        );
        assert!(
            !logs.iter().any(|l| l.contains(secret)),
            "secret value must not leak into logs: {logs:?}"
        );
    }
}
