use tokio::sync::mpsc::Receiver;

use crate::recipe::loader::Catalog;
use crate::recipe::plan::{InstallPlan, PlannedStep, Section};
use crate::recipe::schema::Platform;
use crate::runner::download::Downloader;
use crate::runner::events::{ProgressEmitter, ProgressEvent, StepStatus};
use crate::runner::process::ProcessRunner;
use crate::runner::secrets::SecretVault;
use crate::runner::{execute_step, StepOutcome, UrlOpener};

pub struct RunDeps<'a, P: ProcessRunner, E: ProgressEmitter, O: UrlOpener, D: Downloader> {
    pub process: &'a P,
    pub emitter: &'a E,
    pub opener: &'a O,
    pub downloader: &'a D,
    pub vault: SecretVault,
}

pub struct RunReport {
    pub success: bool,
    pub failed_step: Option<ProgressEvent>,
}

pub async fn run_plan<P: ProcessRunner, E: ProgressEmitter, O: UrlOpener, D: Downloader>(
    plan: &InstallPlan,
    catalog: &Catalog,
    platform: Platform,
    run_id: &str,
    mut deps: RunDeps<'_, P, E, O, D>,
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
                    };
                }
            }
        }
    }
    deps.emitter.progress(&done(true, "모두 끝났어요"));
    RunReport {
        success: true,
        failed_step: None,
    }
}

/// 실패한 레시피의 rollback 섹션을 best-effort 실행 (결과는 log로만, 이벤트 없음).
/// 플랜과 같은 platform 인자를 쓴다 — 실행 OS 추측(Platform::current) 금지,
/// 그래야 어느 CI 러너에서든 양쪽 플랫폼 플랜을 테스트할 수 있다.
async fn rollback<P: ProcessRunner, E: ProgressEmitter, O: UrlOpener, D: Downloader>(
    failed: &PlannedStep,
    catalog: &Catalog,
    platform: Platform,
    run_id: &str,
    deps: &RunDeps<'_, P, E, O, D>,
) {
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
    ) -> RunDeps<'a, FakeProcessRunner, CollectingEmitter, FakeUrlOpener, FakeDownloader> {
        RunDeps {
            process: p,
            emitter: e,
            opener: o,
            downloader: d,
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
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-1",
            deps(&process, &emitter, &opener, &downloader),
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
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-2",
            deps(&process, &emitter, &opener, &downloader),
            &mut rx,
        )
        .await;
        assert!(!report.success);
        assert!(report.failed_step.is_some());
        // rollback의 echo까지 3번 호출됐는지
        assert_eq!(process.calls().len(), 3);
        assert!(process.calls()[2].1.join(" ").contains("rollback"));
        assert!(matches!(
            emitter.events().last().unwrap().status,
            StepStatus::Done { success: false }
        ));
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
        let (_tx, mut rx) = tokio::sync::mpsc::channel(1);
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-3",
            deps(&process, &emitter, &opener, &downloader),
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
        let (tx, mut rx) = tokio::sync::mpsc::channel(1);
        tx.send(("api_key".to_string(), "sk-1".to_string()))
            .await
            .unwrap();
        let report = run_plan(
            &plan,
            &catalog,
            Platform::Mac,
            "run-4",
            deps(&process, &emitter, &opener, &downloader),
            &mut rx,
        )
        .await;
        assert!(report.success);
        assert!(emitter.events().iter().any(
            |e| matches!(&e.status, StepStatus::WaitingSecret { label } if label == "api_key")
        ));
    }
}
