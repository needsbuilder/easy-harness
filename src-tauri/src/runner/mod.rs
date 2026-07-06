pub mod diagnostics;
pub mod download;
pub mod dry_run;
pub mod error_hints;
pub mod events;
pub mod process;
pub mod pty;
pub mod secrets;
pub mod step_runner;

use crate::recipe::schema::Step;
use download::Downloader;
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

/// 사용자 홈 폴더 (mac: $HOME, windows: %USERPROFILE%)
pub fn home_dir() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default()
}

/// 스텝 문자열의 "{{home}}"을 홈 폴더로 치환
pub fn expand_home(text: &str) -> String {
    text.replace("{{home}}", &home_dir())
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
    downloader: &impl Downloader,
) -> StepOutcome {
    match step {
        Step::CheckCommand { command, args, .. } | Step::RunCommand { command, args, .. } => {
            let command = expand_home(&vault.substitute(command));
            let args: Vec<String> = args
                .iter()
                .map(|a| expand_home(&vault.substitute(a)))
                .collect();
            match runner.run(&command, &args).await {
                Ok(out) if out.exit_code == 0 => StepOutcome::Success {
                    log: vault.mask(&format!("{}{}", out.stdout, out.stderr)),
                },
                Ok(out) => {
                    let raw = format!("exit={}\n{}{}", out.exit_code, out.stdout, out.stderr);
                    StepOutcome::Failure {
                        message: error_hints::hint_for(&raw).unwrap_or_else(|| {
                            "이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?".into()
                        }),
                        log: vault.mask(&raw),
                    }
                }
                Err(e) => StepOutcome::Failure {
                    message: error_hints::hint_for(&e.to_string())
                        .unwrap_or_else(|| "명령을 시작하지 못했어요. 다시 시도해 볼까요?".into()),
                    log: vault.mask(&e.to_string()),
                },
            }
        }
        Step::PathCheck { path, .. } => {
            let path = expand_home(&vault.substitute(path));
            if std::path::Path::new(&path).exists() {
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
            let target = expand_home(&vault.substitute(url));
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
        Step::DownloadRun {
            url,
            file_name,
            command,
            args,
            ..
        } => {
            let url = expand_home(&vault.substitute(url));
            let dest = std::env::temp_dir().join(file_name);
            if let Err(e) = downloader.download(&url, &dest).await {
                return StepOutcome::Failure {
                    message: "내려받는 중에 인터넷이 잠깐 끊겼어요. 다시 시도해 볼까요?".into(),
                    log: vault.mask(&e),
                };
            }
            let file = dest.to_string_lossy();
            let command = expand_home(&vault.substitute(command)).replace("{{file}}", &file);
            let args: Vec<String> = args
                .iter()
                .map(|a| expand_home(&vault.substitute(a)).replace("{{file}}", &file))
                .collect();
            match runner.run(&command, &args).await {
                Ok(out) if out.exit_code == 0 => StepOutcome::Success {
                    log: vault.mask(&format!("{}{}", out.stdout, out.stderr)),
                },
                Ok(out) => {
                    let raw = format!("exit={}\n{}{}", out.exit_code, out.stdout, out.stderr);
                    StepOutcome::Failure {
                        message: error_hints::hint_for(&raw).unwrap_or_else(|| {
                            "설치 프로그램이 잘 끝나지 않았어요. 다시 시도해 볼까요?".into()
                        }),
                        log: vault.mask(&raw),
                    }
                }
                Err(e) => StepOutcome::Failure {
                    message: error_hints::hint_for(&e.to_string()).unwrap_or_else(|| {
                        "설치 프로그램을 시작하지 못했어요. 다시 시도해 볼까요?".into()
                    }),
                    log: vault.mask(&e.to_string()),
                },
            }
        }
        // 마일스톤 3 후반(Task 14)에서 배선: pty_session은 run_plan이 직접 처리
        Step::PtySession { .. } => StepOutcome::Unsupported,
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
        let downloader = download::FakeDownloader::default();
        let step = Step::RunCommand {
            friendly: "설치 중".into(),
            command: "brew".into(),
            args: vec!["install".into()],
        };
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener, &downloader).await,
            StepOutcome::Success { .. }
        ));
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener, &downloader).await,
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
        let downloader = download::FakeDownloader::default();
        let step = Step::CheckCommand {
            friendly: "확인 중".into(),
            command: "ghost".into(),
            args: vec![],
        };
        let StepOutcome::Failure { message, .. } =
            execute_step(&step, &runner, &vault, &opener, &downloader).await
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
        let downloader = download::FakeDownloader::default();
        assert!(matches!(
            execute_step(&good, &runner, &vault, &opener, &downloader).await,
            StepOutcome::Success { .. }
        ));
        assert!(matches!(
            execute_step(&bad, &runner, &vault, &opener, &downloader).await,
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
        let downloader = download::FakeDownloader::default();
        let step = Step::PtySession {
            friendly: "터미널".into(),
            command: "x".into(),
            args: vec![],
        };
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener, &downloader).await,
            StepOutcome::Unsupported
        ));
    }

    #[tokio::test]
    async fn open_url_goes_through_opener() {
        let runner = FakeProcessRunner::new(vec![]);
        let opener = FakeUrlOpener::default();
        let vault = SecretVault::new();
        let downloader = download::FakeDownloader::default();
        let step = Step::OpenUrl {
            friendly: "로그인 창".into(),
            url: "https://example.com".into(),
        };
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener, &downloader).await,
            StepOutcome::Success { .. }
        ));
        assert_eq!(opener.opened(), vec!["https://example.com".to_string()]);
    }

    #[tokio::test]
    async fn input_secret_requests_when_missing_and_passes_when_present() {
        let runner = FakeProcessRunner::new(vec![]);
        let opener = FakeUrlOpener::default();
        let downloader = download::FakeDownloader::default();
        let step = Step::InputSecret {
            friendly: "키를 넣어 주세요".into(),
            label: "api_key".into(),
        };
        let vault = SecretVault::new();
        assert!(matches!(
            execute_step(&step, &runner, &vault, &opener, &downloader).await,
            StepOutcome::NeedsSecret { .. }
        ));
        let mut vault2 = SecretVault::new();
        vault2.insert("api_key", "v");
        assert!(matches!(
            execute_step(&step, &runner, &vault2, &opener, &downloader).await,
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
        let downloader = download::FakeDownloader::default();
        let mut vault = SecretVault::new();
        vault.insert("api_key", "sk-live-1234");
        let step = Step::RunCommand {
            friendly: "키 등록 중".into(),
            command: "tool".into(),
            args: vec!["--key={{secret:api_key}}".into()],
        };
        let StepOutcome::Failure { log, .. } =
            execute_step(&step, &runner, &vault, &opener, &downloader).await
        else {
            panic!("Failure여야 함");
        };
        assert_eq!(runner.calls()[0].1, vec!["--key=sk-live-1234".to_string()]); // 실행엔 실값
        assert!(!log.contains("sk-live-1234")); // 로그엔 마스킹
        assert!(log.contains("•••"));
    }

    #[tokio::test]
    async fn download_run_downloads_then_runs_with_file_substituted() {
        use crate::runner::download::FakeDownloader;
        let runner = FakeProcessRunner::new(vec![ok("installed")]);
        let vault = SecretVault::new();
        let opener = FakeUrlOpener::default();
        let downloader = FakeDownloader::new(vec![Ok(())]);
        let step = Step::DownloadRun {
            friendly: "설치 파일을 내려받아 실행하고 있어요".into(),
            url: "https://example.com/tool.pkg".into(),
            file_name: "tool.pkg".into(),
            command: "open".into(),
            args: vec!["-W".into(), "{{file}}".into()],
        };
        let out = execute_step(&step, &runner, &vault, &opener, &downloader).await;
        assert!(matches!(out, StepOutcome::Success { .. }));
        let expected = std::env::temp_dir().join("tool.pkg");
        assert_eq!(downloader.calls()[0].1, expected);
        let (cmd, args) = &runner.calls()[0];
        assert_eq!(cmd, "open");
        assert_eq!(args[1], expected.to_string_lossy());
    }

    #[tokio::test]
    async fn download_run_failure_is_friendly() {
        use crate::runner::download::FakeDownloader;
        let runner = FakeProcessRunner::new(vec![]);
        let vault = SecretVault::new();
        let opener = FakeUrlOpener::default();
        let downloader = FakeDownloader::new(vec![Err("연결 끊김".into())]);
        let step = Step::DownloadRun {
            friendly: "설치 파일을 내려받아 실행하고 있어요".into(),
            url: "https://example.com/tool.pkg".into(),
            file_name: "tool.pkg".into(),
            command: "open".into(),
            args: vec![],
        };
        let StepOutcome::Failure { message, .. } =
            execute_step(&step, &runner, &vault, &opener, &downloader).await
        else {
            panic!("Failure여야 함");
        };
        assert_eq!(
            message,
            "내려받는 중에 인터넷이 잠깐 끊겼어요. 다시 시도해 볼까요?"
        );
        assert!(runner.calls().is_empty()); // 실패 시 실행하지 않는다
    }

    #[tokio::test]
    async fn home_placeholder_is_expanded_in_command_and_args() {
        let runner = FakeProcessRunner::new(vec![ok("v1")]);
        let vault = SecretVault::new();
        let opener = FakeUrlOpener::default();
        let downloader = crate::runner::download::FakeDownloader::default();
        let step = Step::CheckCommand {
            friendly: "확인 중".into(),
            command: "{{home}}/.local/bin/tool".into(),
            args: vec!["--config={{home}}/.tool.json".into()],
        };
        let _ = execute_step(&step, &runner, &vault, &opener, &downloader).await;
        let home = crate::runner::home_dir();
        assert_eq!(runner.calls()[0].0, format!("{home}/.local/bin/tool"));
        assert_eq!(
            runner.calls()[0].1[0],
            format!("--config={home}/.tool.json")
        );
        assert!(!home.is_empty());
    }

    #[tokio::test]
    async fn failure_message_uses_stderr_hint_when_matched() {
        let runner = FakeProcessRunner::new(vec![fail("EACCES: permission denied")]);
        let vault = SecretVault::new();
        let opener = FakeUrlOpener::default();
        let downloader = download::FakeDownloader::default();
        let step = Step::RunCommand {
            friendly: "설치 중".into(),
            command: "tool".into(),
            args: vec![],
        };
        let StepOutcome::Failure { message, .. } =
            execute_step(&step, &runner, &vault, &opener, &downloader).await
        else {
            panic!("Failure여야 함");
        };
        assert!(message.contains("권한"), "힌트가 반영돼야 함: {message}");
    }

    #[tokio::test]
    async fn open_url_substitutes_secret_and_masks_log() {
        let runner = FakeProcessRunner::new(vec![]);
        let opener = FakeUrlOpener::default();
        let downloader = download::FakeDownloader::default();
        let mut vault = SecretVault::new();
        vault.insert("api_key", "tok-999");
        let step = Step::OpenUrl {
            friendly: "발급 페이지".into(),
            url: "https://x.test/issue?key={{secret:api_key}}".into(),
        };
        let StepOutcome::Success { log } =
            execute_step(&step, &runner, &vault, &opener, &downloader).await
        else {
            panic!("Success여야 함");
        };
        assert!(opener.opened()[0].contains("tok-999")); // 실제 열기엔 실값
        assert!(!log.contains("tok-999")); // 로그엔 마스킹
        assert!(log.contains("•••"));
    }
}
