use std::path::Path;

use crate::error::EngineError;
use crate::recipe::loader::Catalog;
use crate::recipe::signing::{verify_bundle, RECIPE_PUBKEY_B64};

pub const REMOTE_BASE: &str =
    "https://raw.githubusercontent.com/needslab-ai/easy-harness-recipes/main";

/// 캐시된 원격 번들을 검증해 로딩. 서명·파싱 실패 또는 버전이 낮으면 None.
pub fn load_cached(cache_dir: &Path, min_version: u64) -> Option<Catalog> {
    load_cached_with_key(cache_dir, min_version, RECIPE_PUBKEY_B64)
}

fn load_cached_with_key(cache_dir: &Path, min_version: u64, pubkey_b64: &str) -> Option<Catalog> {
    let bundle = std::fs::read(cache_dir.join("recipes-bundle.json")).ok()?;
    let sig = std::fs::read_to_string(cache_dir.join("recipes-bundle.json.sig")).ok()?;
    verify_bundle(&bundle, &sig, pubkey_b64).ok()?;
    let (version, catalog) = Catalog::from_bundle(&String::from_utf8(bundle).ok()?).ok()?;
    (version >= min_version).then_some(catalog)
}

/// 원격에서 번들·서명을 받아 검증 후 캐시에 저장. 새로 저장했으면 true.
pub async fn refresh(url_base: &str, cache_dir: &Path) -> Result<bool, EngineError> {
    let get = |path: String| async move {
        let resp = reqwest::get(&path)
            .await
            .map_err(|e| std::io::Error::other(e.to_string()))?;
        if !resp.status().is_success() {
            return Err(std::io::Error::other(format!("HTTP {}", resp.status())));
        }
        resp.bytes()
            .await
            .map_err(|e| std::io::Error::other(e.to_string()))
    };
    let bundle = get(format!("{url_base}/recipes-bundle.json")).await?;
    let sig = String::from_utf8_lossy(&get(format!("{url_base}/recipes-bundle.json.sig")).await?)
        .into_owned();
    verify_bundle(&bundle, &sig, RECIPE_PUBKEY_B64)?;
    Catalog::from_bundle(&String::from_utf8_lossy(&bundle))?; // 파싱 가능해야 캐시
    std::fs::create_dir_all(cache_dir)?;
    std::fs::write(cache_dir.join("recipes-bundle.json"), &bundle)?;
    std::fs::write(cache_dir.join("recipes-bundle.json.sig"), sig)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine as _;
    use ed25519_dalek::{Signer, SigningKey};

    // load_cached는 실키가 아닌 테스트 키로 검증할 수 있도록 내부 함수를 분리해 테스트한다:
    // verify_bundle 호출부를 pubkey 파라미터로 받는 load_cached_with_key(cache_dir, min_version, pubkey)로
    // 구현하고, load_cached는 RECIPE_PUBKEY_B64를 넘기는 한 줄 래퍼로 둔다.
    #[test]
    fn cached_bundle_roundtrip_with_signature() {
        let key = SigningKey::from_bytes(&[9u8; 32]);
        let b64 = base64::engine::general_purpose::STANDARD;
        let pubkey = b64.encode(key.verifying_key().to_bytes());
        let mock = std::fs::read_to_string(Catalog::fixture_dir().join("mock-tool.json")).unwrap();
        let bundle = format!(r#"{{"bundleVersion": 2, "recipes": [{mock}]}}"#);
        let sig = b64.encode(key.sign(bundle.as_bytes()).to_bytes());
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("recipes-bundle.json"), &bundle).unwrap();
        std::fs::write(dir.path().join("recipes-bundle.json.sig"), &sig).unwrap();
        assert!(load_cached_with_key(dir.path(), 1, &pubkey).is_some());
        assert!(load_cached_with_key(dir.path(), 3, &pubkey).is_none()); // 버전 낮음
        std::fs::write(
            dir.path().join("recipes-bundle.json"),
            bundle.replace('2', "9"),
        )
        .unwrap();
        assert!(load_cached_with_key(dir.path(), 1, &pubkey).is_none()); // 서명 불일치
    }
}
