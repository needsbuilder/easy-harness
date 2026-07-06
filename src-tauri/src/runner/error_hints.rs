//! 실패 로그(stderr·stdout·exit)에서 흔한 원인을 찾아 쉬운 말 안내를 만든다.
//! 스펙 6절 ⑤: 공통 패턴 테이블만 (레시피별 선언 확장은 안 한다).

pub fn hint_for(log: &str) -> Option<String> {
    let lower = log.to_lowercase();
    // 첫 매칭 승. 네트워크가 가장 흔하니 맨 앞.
    const RULES: &[(&[&str], &str)] = &[
        (
            &["could not resolve host", "getaddrinfo", "enotfound", "etimedout",
              "connection refused", "network is unreachable", "econnreset", "timed out"],
            "인터넷 연결이 불안정한 것 같아요. 와이파이를 확인한 뒤 다시 시도해 주세요.",
        ),
        (
            &["xcrun: error", "invalid active developer path", "developer tools were not found"],
            "맥 개발자 도구가 필요해요. 화면에 설치 창이 뜨면 설치를 눌러 주세요. 끝나면 여기서 다시 시도하면 돼요.",
        ),
        (
            &["permission denied", "eacces", "eperm", "operation not permitted", "access is denied"],
            "컴퓨터가 권한 문제로 막았어요. 앱을 껐다 켠 뒤 다시 시도해 주세요.",
        ),
        (
            &["command not found", "not recognized as an internal", "enoent",
              "no such file or directory"],
            "필요한 프로그램을 아직 찾지 못했어요. 다시 시도하면 준비물부터 챙겨서 진행해요.",
        ),
        (
            &["invalid api key", "invalid_api_key", "unauthorized", "\"401\"", " 401 ",
              "authentication failed", "인증키"],
            "등록한 열쇠(인증키)가 맞지 않는 것 같아요. 발급 페이지에서 값을 다시 복사해 붙여넣어 주세요.",
        ),
    ];
    for (needles, hint) in RULES {
        if needles.iter().any(|n| lower.contains(n)) {
            return Some((*hint).to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn network_permission_missing_devtools_and_key_hints() {
        assert!(hint_for("curl: Could not resolve host claude.ai")
            .unwrap()
            .contains("인터넷"));
        assert!(hint_for("EACCES: permission denied")
            .unwrap()
            .contains("권한"));
        assert!(hint_for("zsh: command not found: npx")
            .unwrap()
            .contains("프로그램"));
        assert!(hint_for("xcrun: error: invalid active developer path")
            .unwrap()
            .contains("개발자 도구"));
        assert!(hint_for("Error: invalid API key provided")
            .unwrap()
            .contains("인증키"));
        assert!(hint_for("전혀 모르는 이상한 출력").is_none());
    }

    #[test]
    fn hints_obey_copy_rules() {
        for sample in [
            "Could not resolve host",
            "permission denied",
            "command not found",
            "xcrun: error",
            "invalid api key",
        ] {
            let h = hint_for(sample).unwrap();
            assert!(!h.contains('—'), "em dash 금지: {h}");
            assert!(!h.trim().is_empty());
        }
    }
}
