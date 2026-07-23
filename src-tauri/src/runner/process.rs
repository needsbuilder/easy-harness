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
        #[cfg(unix)]
        if let Some(path) = login_shell_path() {
            cmd.env("PATH", path);
        }
        let out = cmd.output().await?;
        Ok(ProcessOutput {
            exit_code: out.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
        })
    }
}

/// 로그인 셸 PATH를 구할 때 프로필 배너와 섞이지 않게 붙이는 표시.
/// (`-lc`는 .zprofile 등을 읽는데, 거기서 뭔가 출력하는 사람이 있다)
#[cfg(unix)]
const PATH_MARKER: &str = "__EH_PATH__";

/// 맥·리눅스: 로그인 셸이 보는 PATH를 한 번만 구해 캐시한다.
///
/// Finder·런치패드로 켠 GUI 앱은 `/usr/bin:/bin:/usr/sbin:/sbin` 만 물려받는다.
/// 그래서 사용자가 이미 깔아둔 node·bun·brew를 자식 프로세스가 못 찾고,
/// 설치 스크립트가 "없다"고 판단해 엉뚱한 걸 깔려 든다.
/// (실측 2026-07-23: OpenClaw 설치기가 node를 못 찾아 Homebrew를 sudo로
/// 설치하려다 TTY가 없어 실패)
///
/// 실패하면 None을 돌려주고 호출 측은 상속받은 PATH를 그대로 쓴다.
#[cfg(unix)]
pub(crate) fn login_shell_path() -> Option<&'static str> {
    static CACHE: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();
    CACHE
        .get_or_init(|| resolve_login_shell_path(&user_shell()))
        .as_deref()
}

/// 앱이 웹뷰를 띄우는 동안 미리 데워 둔다. 첫 화면 환경 점검이 셸을 기다리며
/// 멈추는 걸 막는다(느린 프로필이면 최대 8초까지 갈 수 있다).
#[cfg(unix)]
pub fn prewarm_login_shell_path() {
    let _ = std::thread::Builder::new()
        .name("eh-path-prewarm".into())
        .spawn(|| {
            let _ = login_shell_path();
        });
}

#[cfg(not(unix))]
pub fn prewarm_login_shell_path() {}

/// 사용자의 로그인 셸. `$SHELL` 이 이상하면 맥 기본값으로 돌아간다.
#[cfg(unix)]
fn user_shell() -> String {
    std::env::var("SHELL")
        .ok()
        .filter(|s| s.starts_with('/') && std::path::Path::new(s).is_file())
        .unwrap_or_else(|| "/bin/zsh".to_string())
}

/// 셸을 태워 PATH를 구한다. 셸 경로를 인자로 받아 테스트에서 가짜 셸을 끼울 수 있게 한다.
#[cfg(unix)]
fn resolve_login_shell_path(shell: &str) -> Option<String> {
    // 대화형(-i)을 먼저 쓴다. 많은 사람이 PATH를 .zshrc(대화형 전용)에서 늘리기 때문이다.
    // 실측 2026-07-23: `-lc` 는 17개 항목이라 bun을 놓치고, `-ilc` 는 30개로 다 잡았다.
    // .zshrc가 멈추거나(예: exec tmux) 출력이 PATH 모양이 아니면(fish 등) 비대화형으로 물러난다.
    for (flags, secs) in [("-ilc", 5), ("-lc", 3)] {
        if let Some(path) = run_shell_for_path(shell, flags, secs) {
            return Some(merge_with_current(&path));
        }
    }
    None
}

/// 셸을 한 번 태워 PATH를 받아온다. 프로필이 멈출 수 있어 스레드로 감싸고 시간을 끊는다.
/// 못 구하면 None이고, 호출 측은 상속받은 PATH를 그대로 쓴다 = 고치기 전과 같은 동작.
///
/// 알려진 한계: 시간이 끊겨도 이 스레드는 `output()` 에 매달린 채 남는다. 프로필이 띄운
/// 데몬이 stdout 파이프를 물고 있으면 셸이 끝나도 EOF가 안 오기 때문이다. 앱 수명당
/// 최대 2개(-ilc·-lc)라 방치해도 되는 수준으로 보고, 대신 stderr는 버려서 수다스러운
/// 프로필이 파이프를 채워 멈추는 흔한 경로를 막는다.
#[cfg(unix)]
fn run_shell_for_path(shell: &str, flags: &str, timeout_secs: u64) -> Option<String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let shell = shell.to_string();
    let flags = flags.to_string();
    // spawn 실패를 패닉이 아니라 None으로 처리해야 캐시에 실패가 기록된다.
    // 안 그러면 이후 모든 실행이 매번 이 느린 경로를 다시 탄다.
    std::thread::Builder::new()
        .name("eh-path-probe".into())
        .spawn(move || {
            let out = std::process::Command::new(&shell)
                .args([&flags, &format!("printf '\\n{PATH_MARKER}%s\\n' \"$PATH\"")])
                .stdin(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .output();
            let _ = tx.send(out);
        })
        .ok()?;
    let out = rx
        .recv_timeout(std::time::Duration::from_secs(timeout_secs))
        .ok()?
        .ok()?;
    if !out.status.success() {
        return None;
    }
    extract_marked_path(&String::from_utf8_lossy(&out.stdout))
}

/// 프로필 배너가 섞인 출력에서 표시가 붙은 줄만 골라 PATH를 꺼낸다.
///
/// 조각 단위로 검사해서 PATH 모양이 아니면 거절한다. fish는 `-ilc` 를 받아주지만
/// `$PATH` 가 리스트라 공백으로 이어 붙인 한 덩어리를 내놓는데, 그걸 통과시키면
/// 존재하지 않는 디렉터리 하나가 PATH 맨 앞에 붙고 폴백도 안 돌아 아무 개선이 없다.
#[cfg(unix)]
fn extract_marked_path(stdout: &str) -> Option<String> {
    let line = stdout
        .lines()
        .rev()
        .find_map(|l| l.trim().strip_prefix(PATH_MARKER))?;
    let line = line.trim();
    if line.is_empty() {
        return None;
    }
    let all_absolute = line
        .split(':')
        .filter(|s| !s.is_empty())
        .all(|s| s.starts_with('/') && !s.contains(char::is_whitespace));
    let has_any = line.split(':').any(|s| !s.is_empty());
    (all_absolute && has_any).then(|| line.to_string())
}

/// 로그인 셸 PATH 뒤에 현재 프로세스 PATH를 덧붙인다.
/// 로그인 셸이 시스템 경로를 빠뜨려도 지금 되던 건 계속 되게 하는 안전망.
#[cfg(unix)]
fn merge_with_current(login_path: &str) -> String {
    merge_paths(login_path, &std::env::var("PATH").unwrap_or_default())
}

/// 앞쪽 PATH를 우선하고 뒤쪽을 덧붙인다(중복 제거, 순서 보존).
/// 환경변수를 안 읽는 순수 함수라 테스트가 병렬로 돌아도 안전하다.
/// 절대 경로가 아닌 조각(빈 문자열 = 현재 폴더, `.` 등)은 버린다.
#[cfg(unix)]
fn merge_paths(first: &str, second: &str) -> String {
    let mut seen = std::collections::HashSet::new();
    let mut out: Vec<&str> = Vec::new();
    for part in first.split(':').chain(second.split(':')) {
        if !part.starts_with('/') {
            continue;
        }
        if seen.insert(part) {
            out.push(part);
        }
    }
    out.join(":")
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
    #[allow(unused_imports)]
    use super::*;

    #[cfg(unix)]
    #[test]
    fn merge_keeps_login_path_first_and_dedups() {
        assert_eq!(
            merge_paths("/opt/homebrew/bin:/usr/bin", "/usr/bin:/bin"),
            "/opt/homebrew/bin:/usr/bin:/bin"
        );
    }

    /// 빈 조각(= 현재 폴더)과 상대 경로는 자식에게 넘기지 않는다.
    #[cfg(unix)]
    #[test]
    fn merge_drops_empty_and_relative_segments() {
        assert_eq!(merge_paths("/a::/b", "/bin::"), "/a:/b:/bin");
        assert_eq!(merge_paths(".:/a:relative", "/bin"), "/a:/bin");
    }

    /// fish는 `-ilc` 를 받아주지만 $PATH가 리스트라 공백으로 이어 붙여 내놓는다.
    /// 그걸 통과시키면 없는 디렉터리 하나가 PATH 맨 앞에 붙고 폴백도 안 돈다.
    #[cfg(unix)]
    #[test]
    fn marked_path_rejects_space_joined_fish_output() {
        let fish = format!("{PATH_MARKER}/usr/local/bin /usr/bin /bin\n");
        assert_eq!(extract_marked_path(&fish), None);
    }

    /// 가짜 셸을 끼워 결정론적으로 검사한다. 실제 사용자 프로필에 안 기댄다.
    #[cfg(unix)]
    #[test]
    fn resolve_uses_shell_output_and_rejects_garbage() {
        use std::io::Write;
        use std::os::unix::fs::PermissionsExt;

        fn stub(name: &str, body: &str) -> std::path::PathBuf {
            let p = std::env::temp_dir().join(format!("eh-stub-{name}-{}", std::process::id()));
            let mut f = std::fs::File::create(&p).unwrap();
            writeln!(f, "#!/bin/sh\n{body}").unwrap();
            std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o755)).unwrap();
            p
        }

        let good = stub(
            "good",
            &format!("printf '배너\\n{PATH_MARKER}/opt/eh-test/bin:/usr/bin\\n'"),
        );
        let resolved = resolve_login_shell_path(good.to_str().unwrap()).expect("PATH를 못 구함");
        assert!(
            resolved.starts_with("/opt/eh-test/bin:"),
            "셸이 준 PATH가 앞에 와야 한다: {resolved}"
        );

        let bad = stub("bad", "printf '표시가 없는 출력\\n'");
        assert_eq!(resolve_login_shell_path(bad.to_str().unwrap()), None);

        let _ = std::fs::remove_file(good);
        let _ = std::fs::remove_file(bad);
    }

    /// 이번 수정의 본체: 자식 프로세스가 실제로 넓힌 PATH를 받는가.
    /// `process.rs` 의 주입 블록을 지우면 자식은 상속 PATH를 받아 이 단언이 깨진다.
    /// (터미널에서 돌리면 상속 PATH와 로그인 셸 PATH가 같아 항진명제가 될 수 있으나,
    ///  CI는 러너가 PATH에 도구 캐시를 잔뜩 얹으므로 둘이 달라 회귀를 잡는다.)
    #[cfg(unix)]
    #[tokio::test]
    async fn runner_gives_children_the_resolved_path() {
        let Some(expected) = login_shell_path() else {
            return; // 셸을 못 태우는 환경이면 상속 PATH 그대로가 정상 동작
        };
        let out = TokioProcessRunner
            .run(
                "/bin/sh",
                &["-c".to_string(), "printf %s \"$PATH\"".to_string()],
            )
            .await
            .expect("셸 실행 실패");
        assert_eq!(
            out.stdout.trim(),
            expected,
            "자식 프로세스에 넓힌 PATH가 안 들어갔다"
        );
    }

    /// 로그인 셸이 시스템 경로를 빠뜨려도 상속 PATH가 뒤에 남아 있어야 한다.
    #[cfg(unix)]
    #[test]
    fn merge_keeps_system_dirs_as_safety_net() {
        let merged = merge_paths("/only/custom", "/usr/bin:/bin");
        assert!(merged.starts_with("/only/custom"));
        assert!(merged.contains("/usr/bin"));
    }

    #[cfg(unix)]
    #[test]
    fn marked_path_survives_profile_banner() {
        let stdout = format!("Now using node v20.11.0\n{PATH_MARKER}/opt/homebrew/bin:/usr/bin\n");
        assert_eq!(
            extract_marked_path(&stdout).as_deref(),
            Some("/opt/homebrew/bin:/usr/bin")
        );
    }

    #[cfg(unix)]
    #[test]
    fn marked_path_rejects_garbage() {
        assert_eq!(extract_marked_path("배너만 있고 표시가 없음\n"), None);
        assert_eq!(extract_marked_path(&format!("{PATH_MARKER}\n")), None);
        // 슬래시가 없으면 PATH가 아니다
        assert_eq!(extract_marked_path(&format!("{PATH_MARKER}없음\n")), None);
    }

    /// 실제 셸을 태우는 스모크. 셸이 없거나 프로필이 멈추면 None이 정상이라 그때는 넘어간다.
    /// 결정론적 검증은 위 `resolve_uses_shell_output_and_rejects_garbage` 가 맡는다.
    #[cfg(unix)]
    #[test]
    fn login_shell_path_segments_are_all_absolute() {
        if let Some(path) = login_shell_path() {
            assert!(
                path.split(':').all(|s| s.starts_with('/')),
                "절대 경로가 아닌 조각이 섞임: {path}"
            );
            // 상속 PATH를 뒤에 병합하므로 원래 있던 항목은 반드시 남아 있어야 한다.
            for inherited in std::env::var("PATH").unwrap_or_default().split(':') {
                if inherited.starts_with('/') {
                    assert!(
                        path.split(':').any(|s| s == inherited),
                        "상속 PATH 항목이 사라짐: {inherited}"
                    );
                }
            }
        }
    }

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
