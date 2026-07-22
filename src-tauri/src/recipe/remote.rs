use std::path::Path;
use std::time::Duration;

use crate::error::EngineError;
use crate::recipe::loader::Catalog;
use crate::recipe::signing::{verify_bundle, RECIPE_PUBKEY_B64};

/// 서명된 레시피 번들을 받아올 곳. 소스 레포가 public 이 된 뒤로 별도 레포가 필요 없어져
/// 이 레포의 `recipes-bundle/` 로 합쳤다(2026-07-22). 옛 주소를 보는 v0.1.2 이하 앱을 위해
/// `needslab-ai/easy-harness-recipes` 레포는 지우지 않고 아카이브로 남겨 둔다.
pub const REMOTE_BASE: &str =
    "https://raw.githubusercontent.com/needsbuilder/easy-harness/main/recipes-bundle";

/// 캐시된 원격 번들을 검증해 로딩. 서명·파싱 실패 또는 버전이 낮으면 None.
pub fn load_cached(cache_dir: &Path, min_version: u64) -> Option<Catalog> {
    load_cached_with_key(cache_dir, min_version, RECIPE_PUBKEY_B64)
}

/// 캐시 디렉터리의 번들을 서명 검증까지만 거쳐 읽어온다 (최소 버전 필터링 없음).
/// `store_bundle_with_key`가 "현재 캐시 버전"을 판단할 때 재사용한다.
fn read_cached_with_key(cache_dir: &Path, pubkey_b64: &str) -> Option<(u64, Catalog)> {
    let bundle = std::fs::read(cache_dir.join("recipes-bundle.json")).ok()?;
    let sig = std::fs::read_to_string(cache_dir.join("recipes-bundle.json.sig")).ok()?;
    verify_bundle(&bundle, &sig, pubkey_b64).ok()?;
    Catalog::from_bundle(&String::from_utf8(bundle).ok()?).ok()
}

fn load_cached_with_key(cache_dir: &Path, min_version: u64, pubkey_b64: &str) -> Option<Catalog> {
    let (version, catalog) = read_cached_with_key(cache_dir, pubkey_b64)?;
    (version >= min_version).then_some(catalog)
}

/// 서명·파싱을 검증하고, 현재 캐시보다 버전이 높을 때만 덮어쓴다 (다운그레이드 방지).
/// 새로 저장했으면 true, 서명/파싱은 유효하지만 버전이 현재 캐시 이하라 건너뛰었으면 false.
fn store_bundle_with_key(
    cache_dir: &Path,
    bundle: &[u8],
    sig: &str,
    pubkey_b64: &str,
) -> Result<bool, EngineError> {
    verify_bundle(bundle, sig, pubkey_b64)?;
    let (fetched_version, _) = Catalog::from_bundle(&String::from_utf8_lossy(bundle))?; // 파싱 가능해야 캐시
    if let Some((current_version, _)) = read_cached_with_key(cache_dir, pubkey_b64) {
        if fetched_version <= current_version {
            // 과거에 정당하게 서명된 구버전 번들 재배포 → 조용히 무시 (다운그레이드 차단)
            return Ok(false);
        }
    }
    std::fs::create_dir_all(cache_dir)?;
    std::fs::write(cache_dir.join("recipes-bundle.json"), bundle)?;
    std::fs::write(cache_dir.join("recipes-bundle.json.sig"), sig)?;
    Ok(true)
}

// 백그라운드 1회성 호출이라 실패는 조용히 무시되지만, 타임아웃이 없으면
// 네트워크가 응답 없이 물고만 있을 때 무한 대기로 이어질 수 있어 막아둔다.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// 원격에서 번들·서명을 받아 검증 후 캐시에 저장. 새로 저장했으면 true.
pub async fn refresh(url_base: &str, cache_dir: &Path) -> Result<bool, EngineError> {
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| std::io::Error::other(e.to_string()))?;
    let get = |path: String| {
        let client = client.clone();
        async move {
            let resp = client
                .get(&path)
                .send()
                .await
                .map_err(|e| std::io::Error::other(e.to_string()))?;
            if !resp.status().is_success() {
                return Err(std::io::Error::other(format!("HTTP {}", resp.status())));
            }
            resp.bytes()
                .await
                .map_err(|e| std::io::Error::other(e.to_string()))
        }
    };
    let bundle = get(format!("{url_base}/recipes-bundle.json")).await?;
    let sig = String::from_utf8_lossy(&get(format!("{url_base}/recipes-bundle.json.sig")).await?)
        .into_owned();
    store_bundle_with_key(cache_dir, &bundle, &sig, RECIPE_PUBKEY_B64)
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

    #[test]
    fn store_bundle_rejects_downgrade_but_accepts_upgrade() {
        let key = SigningKey::from_bytes(&[9u8; 32]);
        let b64 = base64::engine::general_purpose::STANDARD;
        let pubkey = b64.encode(key.verifying_key().to_bytes());
        let mock = std::fs::read_to_string(Catalog::fixture_dir().join("mock-tool.json")).unwrap();
        let make_bundle =
            |version: u64| format!(r#"{{"bundleVersion": {version}, "recipes": [{mock}]}}"#);
        let sign = |bundle: &str| b64.encode(key.sign(bundle.as_bytes()).to_bytes());

        let dir = tempfile::tempdir().unwrap();
        let v5 = make_bundle(5);
        std::fs::write(dir.path().join("recipes-bundle.json"), &v5).unwrap();
        std::fs::write(dir.path().join("recipes-bundle.json.sig"), sign(&v5)).unwrap();

        // v3 (다운그레이드): 서명은 유효해도 저장은 거부돼야 한다
        let v3 = make_bundle(3);
        let stored = store_bundle_with_key(dir.path(), v3.as_bytes(), &sign(&v3), &pubkey).unwrap();
        assert!(!stored);
        let cached = std::fs::read_to_string(dir.path().join("recipes-bundle.json")).unwrap();
        assert_eq!(cached, v5); // 캐시는 여전히 v5

        // v6 (업그레이드): 저장돼야 한다
        let v6 = make_bundle(6);
        let stored = store_bundle_with_key(dir.path(), v6.as_bytes(), &sign(&v6), &pubkey).unwrap();
        assert!(stored);
        let cached = std::fs::read_to_string(dir.path().join("recipes-bundle.json")).unwrap();
        assert_eq!(cached, v6); // 캐시가 v6로 교체됨
    }

    // 블랙홀 주소(RFC 5737 TEST-NET-1)로 connect_timeout 적용 여부를 검증한다.
    // 클라이언트 타임아웃이 빠지면 OS 기본 커넥트 타임아웃(수십~수백 초)까지 물고 있어
    // 바깥 20초 타임아웃에 걸려 실패한다.
    #[tokio::test]
    async fn refresh_against_unroutable_host_fails_without_hanging() {
        let dir = tempfile::tempdir().unwrap();
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(20),
            refresh("http://192.0.2.1", dir.path()),
        )
        .await;
        assert!(result.is_ok(), "20초 안에 안 끝남 (타임아웃 미적용 의심)");
        assert!(result.unwrap().is_err());
    }
}
