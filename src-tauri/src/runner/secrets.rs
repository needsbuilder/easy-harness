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
    pub fn mask(&self, text: &str) -> String {
        let mut out = text.to_string();
        for value in self.values.values() {
            if !value.is_empty() {
                out = out.replace(value, "•••");
            }
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
        assert_eq!(vault.substitute("--key={{secret:api_key}}"), "--key=sk-live-1234");
        assert_eq!(vault.substitute("{{secret:none}}"), "{{secret:none}}"); // 미등록은 그대로
        assert_eq!(vault.mask("token sk-live-1234 ok"), "token ••• ok");
        assert!(vault.has("api_key"));
        assert!(!vault.has("none"));
    }
}
