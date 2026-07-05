#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::Mutex;

#[derive(Debug, Clone, PartialEq)]
pub struct ProcessOutput {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

pub trait ProcessRunner: Send + Sync {
    fn run(
        &self,
        command: &str,
        args: &[String],
    ) -> impl std::future::Future<Output = std::io::Result<ProcessOutput>> + Send;
}

pub struct TokioProcessRunner;

impl ProcessRunner for TokioProcessRunner {
    async fn run(&self, command: &str, args: &[String]) -> std::io::Result<ProcessOutput> {
        let mut cmd = tokio::process::Command::new(command);
        cmd.args(args);
        #[cfg(windows)]
        {
            // 콘솔 창 번쩍임 방지
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }
        let out = cmd.output().await?;
        Ok(ProcessOutput {
            exit_code: out.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
        })
    }
}

/// 테스트·드라이런용 가짜 러너. 응답을 순서대로 소비하고 호출을 기록한다.
#[doc(hidden)]
pub struct FakeProcessRunner {
    responses: Mutex<Vec<std::io::Result<ProcessOutput>>>,
    calls: Mutex<Vec<(String, Vec<String>)>>,
}

impl FakeProcessRunner {
    pub fn new(mut responses: Vec<std::io::Result<ProcessOutput>>) -> Self {
        responses.reverse(); // pop()으로 앞에서부터 소비
        FakeProcessRunner {
            responses: Mutex::new(responses),
            calls: Mutex::new(Vec::new()),
        }
    }
    pub fn calls(&self) -> Vec<(String, Vec<String>)> {
        self.calls.lock().unwrap().clone()
    }
}

impl ProcessRunner for FakeProcessRunner {
    async fn run(&self, command: &str, args: &[String]) -> std::io::Result<ProcessOutput> {
        self.calls
            .lock()
            .unwrap()
            .push((command.to_string(), args.to_vec()));
        self.responses.lock().unwrap().pop().unwrap_or_else(|| {
            Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "no scripted response",
            ))
        })
    }
}
