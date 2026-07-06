//! 릴리스 산출물 시크릿 스캔 (CI·개발 전용, 앱 번들 미포함).
//! 사용법: scan_secrets <경로...>
use std::path::Path;

/// (패턴 이름, 마커 바이트, 마커 뒤에 필요한 영숫자 최소 개수)
const PATTERNS: &[(&str, &[u8], usize)] = &[
    ("tauri-updater-개인키", b"rsign encrypted secret key", 0),
    ("minisign-개인키", b"minisign encrypted secret key", 0),
    ("PEM-개인키", b"PRIVATE KEY-----", 0),
    ("Anthropic-API키", b"sk-ant-", 8),
    ("AWS-액세스키", b"AKIA", 16),
    ("GitHub-PAT", b"github_pat_", 20),
    ("GitHub-토큰-ghp", b"ghp_", 30),
    ("GitHub-토큰-gho", b"gho_", 30),
];
const FORBIDDEN_FILE_NAMES: &[&str] = &["recipe-signing-secret.key"];

fn is_token_byte(b: u8) -> bool {
    // '-'도 포함: 실제 Anthropic 키(sk-ant-api03-...)는 버전 구분에 하이픈을 쓴다
    b.is_ascii_alphanumeric() || b == b'_' || b == b'-'
}

/// 데이터에서 발견된 패턴 이름들. 마커 뒤 최소 길이의 토큰 문자가 이어져야 매치(무작위 바이트 오탐 억제).
pub fn find_hits(data: &[u8]) -> Vec<&'static str> {
    let mut hits = Vec::new();
    for (name, marker, min_suffix) in PATTERNS {
        let found = data.windows(marker.len()).enumerate().any(|(i, w)| {
            w == *marker && {
                let tail = &data[i + marker.len()..];
                tail.len() >= *min_suffix && tail[..*min_suffix].iter().all(|b| is_token_byte(*b))
            }
        });
        if found {
            hits.push(*name);
        }
    }
    hits
}

fn scan_path(path: &Path, report: &mut Vec<(String, &'static str)>, count: &mut usize) {
    if path.is_dir() {
        for entry in std::fs::read_dir(path).into_iter().flatten().flatten() {
            scan_path(&entry.path(), report, count);
        }
        return;
    }
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if FORBIDDEN_FILE_NAMES.contains(&name) {
        report.push((path.display().to_string(), "금지 파일명(레시피 개인키)"));
    }
    if let Ok(data) = std::fs::read(path) {
        *count += 1;
        for hit in find_hits(&data) {
            report.push((path.display().to_string(), hit));
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() {
        eprintln!("사용법: scan_secrets <경로...>");
        std::process::exit(2);
    }
    let mut report = Vec::new();
    let mut count = 0usize;
    for a in &args {
        scan_path(Path::new(a), &mut report, &mut count);
    }
    if report.is_empty() {
        println!("시크릿 스캔 통과: 파일 {count}개 검사");
    } else {
        for (path, pat) in &report {
            eprintln!("발견: {pat} → {path}");
        }
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_private_key_markers() {
        assert_eq!(
            find_hits(b"untrusted comment: rsign encrypted secret key\nabc"),
            vec!["tauri-updater-개인키"]
        );
        assert_eq!(
            find_hits(b"-----BEGIN RSA PRIVATE KEY-----"),
            vec!["PEM-개인키"]
        );
    }

    #[test]
    fn detects_api_keys_with_token_suffix() {
        assert!(!find_hits(b"sk-ant-api03-abcdefgh123").is_empty());
        assert!(!find_hits(b"AKIAABCDEFGHIJKLMNOP").is_empty());
        assert!(!find_hits(b"github_pat_11ABCDEFGHIJKLMNOPQRST").is_empty());
    }

    #[test]
    fn ignores_public_keys_and_short_lookalikes() {
        // 업데이터·레시피 공개키는 정상 포함물 → 매치되면 안 됨
        assert!(find_hits(b"untrusted comment: minisign public key ABC").is_empty());
        assert!(find_hits(b"-----BEGIN PUBLIC KEY-----").is_empty());
        // 마커 뒤 토큰이 짧으면 무시 (무작위 바이트 오탐 억제)
        assert!(find_hits(b"AKIA!not-a-key").is_empty());
        assert!(find_hits(b"ghp_short").is_empty());
    }

    #[test]
    fn scans_directories_recursively_and_flags_forbidden_names() {
        let dir = std::env::temp_dir().join(format!("scan-test-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("inner")).unwrap();
        std::fs::write(dir.join("inner/ok.txt"), b"clean file").unwrap();
        std::fs::write(dir.join("inner/recipe-signing-secret.key"), b"x").unwrap();
        let mut report = Vec::new();
        let mut count = 0;
        scan_path(&dir, &mut report, &mut count);
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(report.len(), 1);
        assert!(report[0].1.contains("금지 파일명"));
    }
}
