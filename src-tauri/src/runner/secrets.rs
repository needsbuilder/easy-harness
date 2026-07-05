use std::collections::HashMap;

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
