//! 레시피 번들 서명 도구 (개발자 전용, 앱에 포함되지 않음)
//! keygen: 새 키쌍 생성 (개인키는 절대 커밋 금지)
//! sign <bundle.json> <secret.key>: 분리 서명 파일(bundle.json.sig) 생성
use base64::Engine as _;
use ed25519_dalek::{Signer, SigningKey};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("keygen") => {
            let mut seed = [0u8; 32];
            std::fs::File::open("/dev/urandom")
                .and_then(|mut f| std::io::Read::read_exact(&mut f, &mut seed))
                .expect("난수 소스를 열 수 없어요 (이 도구는 맥/리눅스 전용)");
            let key = SigningKey::from_bytes(&seed);
            let b64 = base64::engine::general_purpose::STANDARD;
            std::fs::write("recipe-signing-secret.key", b64.encode(key.to_bytes())).unwrap();
            println!(
                "공개키(base64): {}",
                b64.encode(key.verifying_key().to_bytes())
            );
            println!("개인키는 recipe-signing-secret.key에 저장됨. 커밋 금지, 안전한 곳에 보관!");
        }
        Some("sign") => {
            let bundle_path = args
                .get(2)
                .expect("사용법: sign <bundle.json> <secret.key>");
            let key_path = args
                .get(3)
                .expect("사용법: sign <bundle.json> <secret.key>");
            let b64 = base64::engine::general_purpose::STANDARD;
            let seed: [u8; 32] = b64
                .decode(std::fs::read_to_string(key_path).unwrap().trim())
                .unwrap()
                .try_into()
                .unwrap();
            let key = SigningKey::from_bytes(&seed);
            let bundle = std::fs::read(bundle_path).unwrap();
            let sig = b64.encode(key.sign(&bundle).to_bytes());
            std::fs::write(format!("{bundle_path}.sig"), &sig).unwrap();
            println!("서명 저장: {bundle_path}.sig");
        }
        _ => eprintln!("사용법: sign_recipes keygen | sign <bundle.json> <secret.key>"),
    }
}
