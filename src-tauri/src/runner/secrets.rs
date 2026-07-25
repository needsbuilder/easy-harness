use std::collections::HashMap;

/// 사용자가 붙여넣은 시크릿을 명령에 넣기 전에 거른다. 값은 `{{secret:...}}` 치환으로
/// 셸 문자열(`zsh -lc "..."` 등) 안에 그대로 들어가므로, 따옴표·`$()`·세미콜론 같은
/// 특수문자가 섞이면 임의 명령 실행으로 이어질 수 있다(2026-07-24 QA 스윕 🔴-5).
/// 실제 API 키·인증키에 쓰이는 문자만 허용한다: 영문·숫자와 `_ - . @ : + = /`
/// 성공 시 앞뒤 공백을 걷어낸 값을 돌려준다(복사할 때 줄바꿈이 따라오는 흔한 실수 흡수).
pub fn validate_secret_value(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("값이 비어 있어요. 발급받은 인증키를 복사해서 붙여넣어 주세요.".into());
    }
    let ok = trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || "_-.@:+=/".contains(c));
    if !ok {
        return Err(
            "쓸 수 없는 문자가 섞여 있어요. 발급받은 인증키만 다시 복사해서 붙여넣어 주세요."
                .into(),
        );
    }
    Ok(trimmed.to_string())
}

#[derive(Default)]
pub struct SecretVault {
    values: HashMap<String, String>,
}

impl SecretVault {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, label: &str, value: &str) {
        self.values.insert(label.to_string(), value.to_string());
    }

    pub fn has(&self, label: &str) -> bool {
        self.values.contains_key(label)
    }

    /// "{{secret:LABEL}}" 자리에 실값. 미등록 라벨은 건드리지 않는다.
    pub fn substitute(&self, text: &str) -> String {
        let mut out = text.to_string();
        for (label, value) in &self.values {
            out = out.replace(&format!("{{{{secret:{label}}}}}"), value);
        }
        out
    }

    /// 로그·이벤트로 나가는 모든 문자열에 적용. 실값을 •••로.
    /// 긴 값 먼저 치환한다. 짧은 비밀값이 긴 비밀값의 일부일 때
    /// 짧은 것이 먼저 치환되면 긴 값의 나머지가 유출되기 때문.
    pub fn mask(&self, text: &str) -> String {
        let mut out = text.to_string();
        let mut values: Vec<&String> = self.values.values().filter(|v| !v.is_empty()).collect();
        values.sort_by(|a, b| b.len().cmp(&a.len()).then_with(|| a.cmp(b)));
        for value in values {
            out = out.replace(value.as_str(), "•••");
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn substitute_and_mask_roundtrip() {
        let mut vault = SecretVault::new();
        vault.insert("api_key", "sk-live-1234");
        assert_eq!(
            vault.substitute("--key={{secret:api_key}}"),
            "--key=sk-live-1234"
        );
        assert_eq!(vault.substitute("{{secret:none}}"), "{{secret:none}}"); // 미등록은 그대로
        assert_eq!(vault.mask("token sk-live-1234 ok"), "token ••• ok");
        assert!(vault.has("api_key"));
        assert!(!vault.has("none"));
    }

    /// 셸 특수문자가 섞인 값은 명령에 들어가기 전에 거른다(임의 명령 실행 차단).
    #[test]
    fn validate_rejects_shell_metacharacters() {
        for bad in [
            "abc; rm -rf ~",
            "abc$(whoami)",
            "abc`id`",
            "abc\"def",
            "abc'def",
            "abc def",
            "abc|def",
            "abc&def",
            "abc>def",
            "abc\\def",
            "한글키",
            "",
            "   ",
        ] {
            assert!(
                validate_secret_value(bad).is_err(),
                "거부돼야 하는 값이 통과함: {bad:?}"
            );
        }
    }

    /// 실존 키 형태는 통과하고, 앞뒤 공백·줄바꿈은 걷어낸다.
    #[test]
    fn validate_accepts_real_key_shapes_and_trims() {
        for good in [
            "sk-live-1234",
            "ybgwon96",
            "AIzaSyB_x.y:z+w=/q",
            "ghp_Abc123",
        ] {
            assert_eq!(validate_secret_value(good).as_deref(), Ok(good));
        }
        assert_eq!(
            validate_secret_value("  sk-live-1234\n").as_deref(),
            Ok("sk-live-1234")
        );
    }

    #[test]
    fn mask_replaces_longest_secret_first() {
        let mut vault = SecretVault::new();
        // 8개의 접두어 비밀값: 어느 하나라도 짧은 것이 먼저 치환되면 꼬리가 남는다
        let full = "abcdefgh";
        for len in 1..=full.len() {
            vault.insert(&format!("k{len}"), &full[..len]);
        }
        assert_eq!(vault.mask("token abcdefgh end"), "token ••• end");
    }
}
