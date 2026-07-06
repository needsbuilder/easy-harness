use serde::Serialize;

use crate::runner::process::ProcessRunner;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvCheck {
    pub id: String,
    pub label: String,
    pub found: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvReport {
    pub os: String,
    pub os_label: String,
    pub arch: String,
    pub checks: Vec<EnvCheck>,
    pub missing_count: usize,
}

/// stdout에서 버전 토큰(예: 1.2.3, v24.16.0)을 뽑는다. 못 찾으면 None (거짓 버전 금지).
pub fn extract_version(stdout: &str) -> Option<String> {
    for token in stdout.split_whitespace() {
        let t = token
            .trim_start_matches('v')
            .trim_end_matches(|c: char| !c.is_ascii_digit());
        let parts: Vec<&str> = t.split('.').collect();
        if parts.len() >= 2
            && parts
                .iter()
                .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
        {
            return Some(t.to_string());
        }
    }
    None
}

/// 도구 하나의 버전을 검출 명령으로 조사한다. 어떤 실패든 None (설치 성공 판정과 무관).
pub async fn probe_tool_version(
    runner: &impl ProcessRunner,
    command: &str,
    args: &[String],
) -> Option<String> {
    match runner.run(command, args).await {
        Ok(out) if out.exit_code == 0 => extract_version(&out.stdout),
        _ => None,
    }
}

pub async fn probe_env(runner: &impl ProcessRunner) -> EnvReport {
    let (os, os_label) = match std::env::consts::OS {
        "macos" => ("mac", "맥"),
        "windows" => ("windows", "윈도우"),
        other => (other, other),
    };
    let mut checks = Vec::new();
    for (id, label, command, args) in [
        (
            "node",
            "Node.js 준비물",
            "node",
            vec!["--version".to_string()],
        ),
        ("git", "git 준비물", "git", vec!["--version".to_string()]),
    ] {
        let result = runner.run(command, &args).await;
        let (found, version) = match result {
            Ok(out) if out.exit_code == 0 => (
                true,
                Some(out.stdout.trim().to_string()).filter(|s| !s.is_empty()),
            ),
            _ => (false, None),
        };
        checks.push(EnvCheck {
            id: id.into(),
            label: label.into(),
            found,
            version,
        });
    }
    let missing_count = checks.iter().filter(|c| !c.found).count();
    EnvReport {
        os: os.into(),
        os_label: os_label.into(),
        arch: std::env::consts::ARCH.into(),
        checks,
        missing_count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runner::process::{FakeProcessRunner, ProcessOutput};

    fn ok(stdout: &str) -> std::io::Result<ProcessOutput> {
        Ok(ProcessOutput {
            exit_code: 0,
            stdout: stdout.into(),
            stderr: String::new(),
        })
    }

    #[tokio::test]
    async fn reports_versions_when_tools_exist() {
        let runner = FakeProcessRunner::new(vec![ok("v24.16.0\n"), ok("git version 2.49.0\n")]);
        let report = probe_env(&runner).await;
        assert_eq!(report.checks.len(), 2);
        assert!(report.checks[0].found);
        assert_eq!(report.checks[0].version.as_deref(), Some("v24.16.0"));
        assert_eq!(report.missing_count, 0);
        assert!(!report.os_label.is_empty());
    }

    #[tokio::test]
    async fn missing_tool_counts() {
        let runner = FakeProcessRunner::new(vec![]); // 응답 없음 = 전부 실패
        let report = probe_env(&runner).await;
        assert_eq!(report.missing_count, 2);
        assert!(report
            .checks
            .iter()
            .all(|c| !c.found && c.version.is_none()));
    }

    #[test]
    fn extract_version_finds_semverish_token() {
        assert_eq!(extract_version("v24.16.0\n").as_deref(), Some("24.16.0"));
        assert_eq!(
            extract_version("git version 2.49.0").as_deref(),
            Some("2.49.0")
        );
        assert_eq!(
            extract_version("omo 4.15.1 (stable)").as_deref(),
            Some("4.15.1")
        );
        assert_eq!(extract_version("1.2.3-beta").as_deref(), Some("1.2.3"));
        assert_eq!(extract_version("버전 없음"), None);
    }

    #[tokio::test]
    async fn probe_tool_version_uses_runner_output() {
        let runner = FakeProcessRunner::new(vec![ok("claude 2.1.201\n")]);
        let v = probe_tool_version(&runner, "claude", &["--version".to_string()]).await;
        assert_eq!(v.as_deref(), Some("2.1.201"));
    }

    #[tokio::test]
    async fn probe_tool_version_none_on_failure() {
        let runner = FakeProcessRunner::new(vec![]); // 응답 없음 = 명령 실패
        let v = probe_tool_version(&runner, "ghost", &[]).await;
        assert_eq!(v, None);
    }
}
