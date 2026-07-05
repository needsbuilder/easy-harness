use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};

/// 세션별 PTY 입력 쓰기 핸들 (pty_input 커맨드가 사용)
pub type PtyInputRegistry = Arc<Mutex<HashMap<String, Box<dyn Write + Send>>>>;

pub trait PtyRunner: Send + Sync {
    /// PTY에서 command를 실행하고 종료 코드를 돌려준다.
    /// 실행 중 출력은 구현체가 이벤트로 스트리밍한다.
    fn run(
        &self,
        session_id: &str,
        command: &str,
        args: &[String],
    ) -> impl std::future::Future<Output = std::io::Result<i32>> + Send;
}

/// 테스트용: 종료 코드를 순서대로 돌려주고 호출을 기록한다.
#[doc(hidden)]
#[derive(Default)]
pub struct FakePtyRunner {
    responses: Mutex<Vec<std::io::Result<i32>>>,
    calls: Mutex<Vec<(String, String)>>,
}

impl FakePtyRunner {
    pub fn new(mut responses: Vec<std::io::Result<i32>>) -> Self {
        responses.reverse();
        FakePtyRunner {
            responses: Mutex::new(responses),
            calls: Mutex::new(Vec::new()),
        }
    }
    pub fn calls(&self) -> Vec<(String, String)> {
        self.calls.lock().unwrap().clone()
    }
}

impl PtyRunner for FakePtyRunner {
    async fn run(&self, session_id: &str, command: &str, _args: &[String]) -> std::io::Result<i32> {
        self.calls
            .lock()
            .unwrap()
            .push((session_id.to_string(), command.to_string()));
        self.responses.lock().unwrap().pop().unwrap_or(Ok(0))
    }
}

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyDataPayload {
    session_id: String,
    data: String,
}

/// 실제 PTY 백엔드. portable-pty로 네이티브 PTY를 열어 명령을 실행하고,
/// 출력을 `pty://data` 이벤트로 스트리밍한다. 입력은 PtyInputRegistry에
/// 등록된 writer로 `pty_input` 커맨드가 전달한다.
pub struct PortablePtyRunner {
    pub app: AppHandle,
    pub inputs: PtyInputRegistry,
}

impl PtyRunner for PortablePtyRunner {
    async fn run(&self, session_id: &str, command: &str, args: &[String]) -> std::io::Result<i32> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 30,
                cols: 100,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(std::io::Error::other)?;
        let mut cmd = CommandBuilder::new(command);
        cmd.args(args);
        #[cfg(windows)]
        if let Some(path) = crate::runner::process::fresh_path() {
            cmd.env("PATH", path);
        }
        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(std::io::Error::other)?;
        drop(pair.slave);

        let writer = pair.master.take_writer().map_err(std::io::Error::other)?;
        self.inputs
            .lock()
            .unwrap()
            .insert(session_id.to_string(), writer);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(std::io::Error::other)?;
        let app = self.app.clone();
        let sid = session_id.to_string();
        let read_task = tauri::async_runtime::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            loop {
                match std::io::Read::read(&mut reader, &mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let _ = app.emit(
                            "pty://data",
                            &PtyDataPayload {
                                session_id: sid.clone(),
                                data: String::from_utf8_lossy(&buf[..n]).into_owned(),
                            },
                        );
                    }
                }
            }
        });

        let status = tauri::async_runtime::spawn_blocking(move || child.wait())
            .await
            .map_err(std::io::Error::other)?
            .map_err(std::io::Error::other)?;
        let _ = read_task.await;
        self.inputs.lock().unwrap().remove(session_id);
        // master는 여기서 drop되며 reader도 EOF로 끝난다
        Ok(status.exit_code() as i32)
    }
}
