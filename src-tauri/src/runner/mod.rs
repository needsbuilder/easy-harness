pub mod process;

use crate::recipe::schema::Step;
use process::{ProcessRunner};

#[derive(Debug)]
pub enum StepOutcome {
    Success { log: String },
    Failure { message: String, log: String },
    Unsupported,
}

pub async fn execute_step(step: &Step, runner: &impl ProcessRunner) -> StepOutcome {
    match step {
        Step::CheckCommand { command, args, .. } | Step::RunCommand { command, args, .. } => {
            match runner.run(command, args).await {
                Ok(out) if out.exit_code == 0 => StepOutcome::Success {
                    log: format!("{}{}", out.stdout, out.stderr),
                },
                Ok(out) => StepOutcome::Failure {
                    message: "이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?".into(),
                    log: format!("exit={}\n{}{}", out.exit_code, out.stdout, out.stderr),
                },
                Err(e) => StepOutcome::Failure {
                    message: "명령을 시작하지 못했어요. 다시 시도해 볼까요?".into(),
                    log: e.to_string(),
                },
            }
        }
        Step::PathCheck { path, .. } => {
            if std::path::Path::new(path).exists() {
                StepOutcome::Success { log: format!("확인됨: {path}") }
            } else {
                StepOutcome::Failure {
                    message: "설치된 자리를 찾지 못했어요.".into(),
                    log: format!("없음: {path}"),
                }
            }
        }
        Step::OpenUrl { .. } | Step::InputSecret { .. }
        | Step::DownloadRun { .. } | Step::PtySession { .. } => StepOutcome::Unsupported,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::schema::Step;
    use crate::runner::process::{FakeProcessRunner, ProcessOutput};

    fn ok(stdout: &str) -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput { exit_code: 0, stdout: stdout.into(), stderr: String::new() })
    }
    fn fail(stderr: &str) -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput { exit_code: 1, stdout: String::new(), stderr: stderr.into() })
    }

    #[tokio::test]
    async fn run_command_success_and_failure() {
        let runner = FakeProcessRunner::new(vec![ok("done"), fail("boom")]);
        let step = Step::RunCommand { friendly: "설치 중".into(), command: "brew".into(), args: vec!["install".into()] };
        assert!(matches!(execute_step(&step, &runner).await, StepOutcome::Success { .. }));
        assert!(matches!(execute_step(&step, &runner).await, StepOutcome::Failure { .. }));
        assert_eq!(runner.calls()[0], ("brew".to_string(), vec!["install".to_string()]));
    }

    #[tokio::test]
    async fn spawn_error_becomes_failure_not_panic() {
        // 응답 큐가 빈 FakeProcessRunner는 NotFound io::Error를 돌려준다
        let runner = FakeProcessRunner::new(vec![]);
        let step = Step::CheckCommand { friendly: "확인 중".into(), command: "ghost".into(), args: vec![] };
        let StepOutcome::Failure { message, .. } = execute_step(&step, &runner).await else {
            panic!("Failure여야 함");
        };
        assert!(!message.is_empty());
    }

    #[tokio::test]
    async fn path_check_uses_filesystem() {
        let dir = tempfile::tempdir().unwrap();
        let good = Step::PathCheck { friendly: "자리 확인".into(), path: dir.path().to_string_lossy().into() };
        let bad = Step::PathCheck { friendly: "자리 확인".into(), path: dir.path().join("없는곳").to_string_lossy().into() };
        let runner = FakeProcessRunner::new(vec![]);
        assert!(matches!(execute_step(&good, &runner).await, StepOutcome::Success { .. }));
        assert!(matches!(execute_step(&bad, &runner).await, StepOutcome::Failure { .. }));
    }

    #[tokio::test]
    async fn real_runner_runs_echo() {
        use crate::runner::process::{ProcessRunner, TokioProcessRunner};
        let out = if cfg!(windows) {
            TokioProcessRunner.run("cmd", &["/C".into(), "echo hi".into()]).await.unwrap()
        } else {
            TokioProcessRunner.run("echo", &["hi".into()]).await.unwrap()
        };
        assert_eq!(out.exit_code, 0);
        assert!(out.stdout.contains("hi"));
    }

    #[tokio::test]
    async fn unwired_steps_report_unsupported() {
        let runner = FakeProcessRunner::new(vec![]);
        let step = Step::PtySession { friendly: "터미널".into(), command: "x".into(), args: vec![] };
        assert!(matches!(execute_step(&step, &runner).await, StepOutcome::Unsupported));
    }
}
