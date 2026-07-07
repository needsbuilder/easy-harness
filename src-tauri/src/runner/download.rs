use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use futures_util::StreamExt;

// 대형 인스톨러는 느린 회선에서 오래 걸릴 수 있어 전체 마감(.timeout)은 걸지 않고,
// 연결 자체와 응답 스톨(읽기 중단)만 제한한다 (진행 중인 느린 다운로드는 죽이지 않음).
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const READ_TIMEOUT: Duration = Duration::from_secs(60);

pub trait Downloader: Send + Sync {
    fn download(
        &self,
        url: &str,
        dest: &Path,
    ) -> impl std::future::Future<Output = Result<(), String>> + Send;
}

pub struct ReqwestDownloader;

impl Downloader for ReqwestDownloader {
    async fn download(&self, url: &str, dest: &Path) -> Result<(), String> {
        let client = reqwest::Client::builder()
            .connect_timeout(CONNECT_TIMEOUT)
            .read_timeout(READ_TIMEOUT)
            .build()
            .map_err(|e| e.to_string())?;
        let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("다운로드 응답 오류: HTTP {}", resp.status()));
        }
        let mut file = tokio::fs::File::create(dest)
            .await
            .map_err(|e| e.to_string())?;
        let mut stream = resp.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
                .await
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

/// 테스트용 가짜 다운로더. 응답을 순서대로 소비하고 호출을 기록한다.
#[doc(hidden)]
#[derive(Default)]
pub struct FakeDownloader {
    responses: Mutex<Vec<Result<(), String>>>,
    calls: Mutex<Vec<(String, std::path::PathBuf)>>,
}

impl FakeDownloader {
    pub fn new(mut responses: Vec<Result<(), String>>) -> Self {
        responses.reverse();
        FakeDownloader {
            responses: Mutex::new(responses),
            calls: Mutex::new(Vec::new()),
        }
    }
    pub fn calls(&self) -> Vec<(String, std::path::PathBuf)> {
        self.calls.lock().unwrap().clone()
    }
}

impl Downloader for FakeDownloader {
    async fn download(&self, url: &str, dest: &Path) -> Result<(), String> {
        self.calls
            .lock()
            .unwrap()
            .push((url.to_string(), dest.to_path_buf()));
        self.responses.lock().unwrap().pop().unwrap_or(Ok(()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn fake_records_calls_and_consumes_responses() {
        let fake = FakeDownloader::new(vec![Err("네트워크 끊김".into()), Ok(())]);
        let dest = std::env::temp_dir().join("x.bin");
        assert!(fake.download("https://a", &dest).await.is_err());
        assert!(fake.download("https://b", &dest).await.is_ok());
        assert_eq!(fake.calls().len(), 2);
        assert_eq!(fake.calls()[0].0, "https://a");
    }

    // 블랙홀 주소(RFC 5737 TEST-NET-1)로 connect_timeout 적용 여부를 검증한다.
    #[tokio::test]
    async fn download_against_unroutable_host_fails_without_hanging() {
        let dest = std::env::temp_dir().join("unroutable.bin");
        let downloader = ReqwestDownloader;
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(20),
            downloader.download("http://192.0.2.1:9/x", &dest),
        )
        .await;
        assert!(result.is_ok(), "20초 안에 안 끝남 (타임아웃 미적용 의심)");
        assert!(result.unwrap().is_err());
    }
}
