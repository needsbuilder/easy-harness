pub mod dry_run;
pub mod events;
pub mod process;
pub mod secrets;
pub mod step_runner;

use crate::recipe::schema::Step;
use process::ProcessRunner;
use secrets::SecretVault;
use std::sync::Mutex;

#[derive(Debug)]
pub enum StepOutcome {
    Success { log: String },
    Failure { message: String, log: String },
    NeedsSecret { label: String, friendly: String },
    Unsupported,
}

pub trait UrlOpener: Send + Sync {
    fn open(&self, url: &str) -> Result<(), String>;
}

#[derive(Default)]
pub struct FakeUrlOpener {
    opened: Mutex<Vec<String>>,
}

impl FakeUrlOpener {
    pub fn opened(&self) -> Vec<String> {
        self.opened.lock().unwrap().clone()
    }
}

impl UrlOpener for FakeUrlOpener {
    fn open(&self, url: &str) -> Result<(), String> {
        self.opened.lock().unwrap().push(url.to_string());
        Ok(())
    }
}

pub async fn execute_step(
    step: &Step,
    runner: &impl ProcessRunner,
    vault: &SecretVault,
    opener: &impl UrlOpener,
) -> StepOutcome {
    match step {
        Step::CheckCommand { command, args, .. } | Step::RunCommand { command, args, .. } => {
            let command = vault.substitute(command);
            let args: Vec<String> = args.iter().map(|a| vault.substitute(a)).collect();
            match runner.run(&command, &args).await {
                Ok(out) if out.exit_code == 0 => StepOutcome::Success {
                    log: vault.mask(&format!("{}{}", out.stdout, out.stderr)),
                },
                Ok(out) => StepOutcome::Failure {
                    message: "이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?".into(),
                    log: vault.mask(&format!(
                        "exit={}\n{}{}",
                        out.exit_code, out.stdout, out.stderr
                    )),
                },
                Err(e) => StepOutcome::Failure {
                    message: "명령을 시작하지 못했어요. 다시 시도해 볼까요?".into(),
                    log: vault.mask(&e.to_string()),
                },
            }
        }
        Step::PathCheck { path, .. } => {
            if std::path::Path::new(path).exists() {
                StepOutcome::Success {
                    log: vault.mask(&format!("확인됨: {path}")),
                }
            } else {
                StepOutcome::Failure {
                    message: "설치된 자리를 찾지 못했어요.".into(),
                    log: vault.mask(&format!("없음: {path}")),
                }
            }
        }
        Step::OpenUrl { url, .. } => {
            let target = vault.substitute(url);
            match opener.open(&target) {
                Ok(()) => StepOutcome::Success {
                    log: vault.mask(&format!("열림: {target}")),
                },
                Err(e) => StepOutcome::Failure {
                    message: "인터넷 창을 열지 못했어요.".into(),
                    log: vault.mask(&e),
                },
            }
        }
        Step::InputSecret { label, friendly } => {
            if vault.has(label) {
                StepOutcome::Success {
                    log: vault.mask(&format!("입력 받음: {label}")),
                }
            } else {
                StepOutcome::NeedsSecret {
                    label: label.clone(),
                    friendly: friendly.clone(),
                }
            }
        }
        // 마일스톤 3에서 배선 (download_run: reqwest 실행기, pty_session: tauri-plugin-pty)
        Step::DownloadRun { .. } | Step::PtySession { .. } => StepOutcome::Unsupported,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::schema::Step;
    use crate::runner::process::{FakeProcessRunner, ProcessOutput};

    fn ok(stdout: &str) -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput {
            exit_code: 0,
            stdout: stdout.into(),
            stderr: String::new(),
        })
    }
    fn fail(stderr: &str) -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput {
            exit_code: 1,
            stdout: String::new(),
            stderr: stderr.into(),
        })
    }

    #[tokio::test]
    async fn run_command_success_and_failure() {
        let runner = FakeProcessRunner::new(vec![ok("done"), fail("boom")]);
        let vault = SecretVault::new();
        let opener = FakeUrlOpener::default();
        let step = Step::RunCommand {
            friendly: "설치 중".into(),
            command: "brew".into(),
            args: vec!["install".into()],
        };
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener).await,
            StepOutcome::Success { .. }
        ));
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener).await,
            StepOutcome::Failure { .. }
        ));
        assert_eq!(
            runner.calls()[0],
            ("brew".to_string(), vec!["install".to_string()])
        );
    }

    #[tokio::test]
    async fn spawn_error_becomes_failure_not_panic() {
        // 응답 큐가 빈 FakeProcessRunner는 NotFound io::Error를 돌려준다
        let runner = FakeProcessRunner::new(vec![]);
        let vault = SecretVault::new();
        let opener = FakeUrlOpener::default();
        let step = Step::CheckCommand {
            friendly: "확인 중".into(),
            command: "ghost".into(),
            args: vec![],
        };
        let StepOutcome::Failure { message, .. } =
            execute_step(&step, &runner, &vault, &opener).await
        else {
            panic!("Failure여야 함");
        };
        assert!(!message.is_empty());
    }

    #[tokio::test]
    async fn path_check_uses_filesystem() {
        let dir = tempfile::tempdir().unwrap();
        let good = Step::PathCheck {
            friendly: "자리 확인".into(),
            path: dir.path().to_string_lossy().into(),
        };
        let bad = Step::PathCheck {
            friendly: "자리 확인".into(),
            path: dir.path().join("없는곳").to_string_lossy().into(),
        };
        let runner = FakeProcessRunner::new(vec![]);
        let vault = SecretVault::new();
        let opener = FakeUrlOpener::default();
        assert!(matches!(
            execute_step(&good, &runner, &vault, &opener).await,
            StepOutcome::Success { .. }
        ));
        assert!(matches!(
            execute_step(&bad, &runner, &vault, &opener).await,
            StepOutcome::Failure { .. }
        ));
    }

    #[tokio::test]
    async fn real_runner_runs_echo() {
        use crate::runner::process::{ProcessRunner, TokioProcessRunner};
        let out = if cfg!(windows) {
            TokioProcessRunner
                .run("cmd", &["/C".into(), "echo hi".into()])
                .await
                .unwrap()
        } else {
            TokioProcessRunner
                .run("echo", &["hi".into()])
                .await
                .unwrap()
        };
        assert_eq!(out.exit_code, 0);
        assert!(out.stdout.contains("hi"));
    }

    #[tokio::test]
    async fn unwired_steps_report_unsupported() {
        let runner = FakeProcessRunner::new(vec![]);
        let vault = SecretVault::new();
        let opener = FakeUrlOpener::default();
        let step = Step::PtySession {
            friendly: "터미널".into(),
            command: "x".into(),
            args: vec![],
        };
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener).await,
            StepOutcome::Unsupported
        ));
    }

    #[tokio::test]
    async fn open_url_goes_through_opener() {
        let runner = FakeProcessRunner::new(vec![]);
        let opener = FakeUrlOpener::default();
        let vault = SecretVault::new();
        let step = Step::OpenUrl {
            friendly: "로그인 창".into(),
            url: "https://example.com".into(),
        };
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener).await,
            StepOutcome::Success { .. }
        ));
        assert_eq!(opener.opened(), vec!["https://example.com".to_string()]);
    }

    #[tokio::test]
    async fn input_secret_requests_when_missing_and_passes_when_present() {
        let runner = FakeProcessRunner::new(vec![]);
        let opener = FakeUrlOpener::default();
        let step = Step::InputSecret {
            friendly: "키를 넣어 주세요".into(),
            label: "api_key".into(),
        };
        let vault = SecretVault::new();
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener).await,
            StepOutcome::NeedsSecret { .. }
        ));
        let mut vault2 = SecretVault::new();
        vault2.insert("api_key", "v");
        assert!(matches!(
            execute_step(&step, &runner, &vault2, &opener).await,
            StepOutcome::Success { .. }
        ));
    }

    #[tokio::test]
    async fn secret_is_substituted_into_args_and_masked_in_log() {
        let runner = FakeProcessRunner::new(vec![Ok(ProcessOutput {
            exit_code: 1,
            stdout: "sk-live-1234 rejected".into(),
            stderr: String::new(),
        })]);
        let opener = FakeUrlOpener::default();
        let mut vault = SecretVault::new();
        vault.insert("api_key", "sk-live-1234");
        let step = Step::RunCommand {
            friendly: "키 등록 중".into(),
            command: "tool".into(),
            args: vec!["--key={{secret:api_key}}".into()],
        };
        let StepOutcome::Failure { log, .. } = execute_step(&step, &runner, &vault, &opener).await
        else {
            panic!("Failure여야 함");
        };
        assert_eq!(runner.calls()[0].1, vec!["--key=sk-live-1234".to_string()]); // 실행엔 실값
        assert!(!log.contains("sk-live-1234")); // 로그엔 마스킹
        assert!(log.contains("•••"));
    }

    #[tokio::test]
    async fn open_url_substitutes_secret_and_masks_log() {
        let runner = FakeProcessRunner::new(vec![]);
        let opener = FakeUrlOpener::default();
        let mut vault = SecretVault::new();
        vault.insert("api_key", "tok-999");
        let step = Step::OpenUrl {
            friendly: "발급 페이지".into(),
            url: "https://x.test/issue?key={{secret:api_key}}".into(),
        };
        let StepOutcome::Success { log } = execute_step(&step, &runner, &vault, &opener).await
        else {
            panic!("Success여야 함");
        };
        assert!(opener.opened()[0].contains("tok-999")); // 실제 열기엔 실값
        assert!(!log.contains("tok-999")); // 로그엔 마스킹
        assert!(log.contains("•••"));
    }
}
