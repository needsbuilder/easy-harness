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
}
