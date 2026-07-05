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
            cmd.creation_flags(0x0800_0000); // 기존: 콘솔 창 번쩍임 방지
            if let Some(path) = fresh_path() {
                cmd.env("PATH", path);
            }
        }
        let out = cmd.output().await?;
        Ok(ProcessOutput {
            exit_code: out.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
        })
    }
}

/// 레지스트리(머신+사용자)에서 현재 PATH를 다시 읽는다.
/// 설치기가 방금 등록한 PATH 항목을 앱 재시작 없이 반영하기 위함.
#[cfg(windows)]
pub(crate) fn fresh_path() -> Option<String> {
    fn query(hive_key: &str) -> Option<String> {
        let out = std::process::Command::new("reg")
            .args(["query", hive_key, "/v", "Path"])
            .creation_flags(0x0800_0000)
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout).into_owned();
        text.lines().find_map(|line| {
            let line = line.trim();
            line.split_once("REG_EXPAND_SZ")
                .or_else(|| line.split_once("REG_SZ"))
                .map(|(_, value)| expand_percent_vars(value.trim()))
        })
    }
    let machine = query(r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment");
    let user = query(r"HKCU\Environment");
    match (machine, user) {
        (Some(m), Some(u)) => Some(format!("{m};{u}")),
        (Some(p), None) | (None, Some(p)) => Some(p),
        (None, None) => None,
    }
}

/// "%VAR%" 형태를 현재 환경변수 값으로 확장 (모르는 변수는 그대로 둔다)
#[cfg(windows)]
fn expand_percent_vars(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        if let Some(end) = after.find('%') {
            let name = &after[..end];
            match std::env::var(name) {
                Ok(v) => out.push_str(&v),
                Err(_) => {
                    out.push('%');
                    out.push_str(name);
                    out.push('%');
                }
            }
            rest = &after[end + 1..];
        } else {
            out.push('%');
            rest = after;
        }
    }
    out.push_str(rest);
    out
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

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    use super::*;

    #[cfg(windows)]
    #[test]
    fn fresh_path_contains_system_dirs() {
        let path = fresh_path().expect("레지스트리 PATH 조회 실패");
        assert!(path.to_lowercase().contains("windows"));
    }

    #[cfg(windows)]
    #[test]
    fn percent_vars_expand() {
        std::env::set_var("EH_TEST_VAR", "C:\\probe");
        assert_eq!(expand_percent_vars("%EH_TEST_VAR%\\bin"), "C:\\probe\\bin");
        assert_eq!(expand_percent_vars("%NO_SUCH_VAR_X%"), "%NO_SUCH_VAR_X%");
    }
}
