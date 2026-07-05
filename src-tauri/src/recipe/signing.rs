use base64::Engine as _;
use ed25519_dalek::{Signature, VerifyingKey};

use crate::error::EngineError;

/// 레시피 배포 공개키 (base64, 32바이트).
/// Step 4에서 sign_recipes keygen으로 실키를 만들어 이 값을 교체한다.
/// (그 전까지는 유효하지 않은 값이라 원격 캐시 검증이 항상 실패 = 안전한 기본값)
pub const RECIPE_PUBKEY_B64: &str = "gnZTCYf0YuKOu6R/mexp7TCnfo9v9PayMypPO6mU6vg=";

pub fn verify_bundle(bundle: &[u8], sig_b64: &str, pubkey_b64: &str) -> Result<(), EngineError> {
    let invalid = |m: &str| EngineError::SignatureInvalid(m.to_string());
    let pk_bytes = base64::engine::general_purpose::STANDARD
        .decode(pubkey_b64)
        .map_err(|_| invalid("공개키 형식"))?;
    let pk_bytes: [u8; 32] = pk_bytes.try_into().map_err(|_| invalid("공개키 길이"))?;
    let key = VerifyingKey::from_bytes(&pk_bytes).map_err(|_| invalid("공개키"))?;
    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(sig_b64.trim())
        .map_err(|_| invalid("서명 형식"))?;
    let sig_bytes: [u8; 64] = sig_bytes.try_into().map_err(|_| invalid("서명 길이"))?;
    let sig = Signature::from_bytes(&sig_bytes);
    key.verify_strict(bundle, &sig)
        .map_err(|_| invalid("서명 불일치"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn test_key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32]) // 테스트 전용 고정 키
    }

    #[test]
    fn valid_signature_passes_and_tampered_fails() {
        let key = test_key();
        let pubkey_b64 =
            base64::engine::general_purpose::STANDARD.encode(key.verifying_key().to_bytes());
        let bundle = br#"{"version":1,"recipes":[]}"#;
        let sig_b64 = base64::engine::general_purpose::STANDARD.encode(key.sign(bundle).to_bytes());
        assert!(verify_bundle(bundle, &sig_b64, &pubkey_b64).is_ok());
        let tampered = br#"{"version":2,"recipes":[]}"#;
        assert!(verify_bundle(tampered, &sig_b64, &pubkey_b64).is_err());
        assert!(verify_bundle(bundle, &sig_b64, "invalid!!").is_err());
    }
}
