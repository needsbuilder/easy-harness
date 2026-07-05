use std::path::Path;
use std::sync::Mutex;

use futures_util::StreamExt;

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
        let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
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
}
