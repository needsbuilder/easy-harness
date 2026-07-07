use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};

/// 세션별 PTY 입력 쓰기 핸들 (pty_input 커맨드가 사용)
pub type PtyInputRegistry = Arc<Mutex<HashMap<String, Box<dyn Write + Send>>>>;

/// 세션별 PTY master 핸들 (pty_resize 커맨드가 사용)
pub type PtyMasterRegistry = Arc<Mutex<HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>>;

/// 등록된 세션의 PTY를 지정 크기로 바꾼다. 세션이 없으면(이미 종료 등) false.
/// 프런트 fit은 세션 종료와 경쟁할 수 있으므로 없는 세션은 에러가 아니라 무시 대상이다.
pub fn resize_master(masters: &PtyMasterRegistry, session_id: &str, cols: u16, rows: u16) -> bool {
    match masters.lock().unwrap().get(session_id) {
        Some(m) => m
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .is_ok(),
        None => false,
    }
}

/// UTF-8 조각을 청크 경계에서도 안전하게 이어붙이는 누적기.
/// PTY는 4096바이트 단위로 읽으므로 멀티바이트 문자가 청크 사이에서 잘릴 수 있다.
/// 불완전한 꼬리는 다음 push()와 합쳐 재시도하고, 스트림이 끝나면 flush()로
/// 남은 바이트를 손실 디코딩(대체 문자 U+FFFD)해 흘려보낸다.
#[derive(Default)]
struct Utf8Reassembler {
    carry: Vec<u8>,
}

impl Utf8Reassembler {
    fn push(&mut self, bytes: &[u8]) -> String {
        let mut buf = std::mem::take(&mut self.carry);
        buf.extend_from_slice(bytes);
        let mut out = String::new();
        let mut offset = 0;
        loop {
            match std::str::from_utf8(&buf[offset..]) {
                Ok(s) => {
                    out.push_str(s);
                    offset = buf.len();
                    break;
                }
                Err(e) => {
                    let valid_up_to = e.valid_up_to();
                    out.push_str(std::str::from_utf8(&buf[offset..offset + valid_up_to]).unwrap());
                    offset += valid_up_to;
                    match e.error_len() {
                        Some(len) => {
                            out.push('\u{FFFD}');
                            offset += len;
                        }
                        None => break,
                    }
                }
            }
        }
        self.carry = buf[offset..].to_vec();
        out
    }

    fn flush(&mut self) -> Option<String> {
        (!self.carry.is_empty())
            .then(|| String::from_utf8_lossy(&std::mem::take(&mut self.carry)).into_owned())
    }
}

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
    pub masters: PtyMasterRegistry,
}

impl PtyRunner for PortablePtyRunner {
    async fn run(&self, session_id: &str, command: &str, args: &[String]) -> std::io::Result<i32> {
        let pty_system = native_pty_system();
        // 초기 크기는 보수적인 80x24. 프런트 TerminalPanel이 마운트 직후 fit 결과로
        // pty_resize를 보내 실제 패널 크기로 맞춘다 (그 전에 나온 출력은 80칸 래핑).
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
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

        // 이 지점부터 child가 살아있으므로, 아래 조기 반환 경로마다
        // registry 정리(insert된 경우)와 child kill+wait 회수를 보장해야
        // 좀비 registry 엔트리·미회수 자식 프로세스가 남지 않는다.
        let writer = match pair.master.take_writer() {
            Ok(w) => w,
            Err(e) => {
                Self::reap_child(child).await;
                return Err(std::io::Error::other(e));
            }
        };
        self.inputs
            .lock()
            .unwrap()
            .insert(session_id.to_string(), writer);

        let mut reader = match pair.master.try_clone_reader() {
            Ok(r) => r,
            Err(e) => {
                self.inputs.lock().unwrap().remove(session_id);
                Self::reap_child(child).await;
                return Err(std::io::Error::other(e));
            }
        };
        self.masters
            .lock()
            .unwrap()
            .insert(session_id.to_string(), pair.master);
        let app = self.app.clone();
        let sid = session_id.to_string();
        let read_task = tauri::async_runtime::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            let mut utf8 = Utf8Reassembler::default();
            loop {
                match std::io::Read::read(&mut reader, &mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let text = utf8.push(&buf[..n]);
                        if !text.is_empty() {
                            let _ = app.emit(
                                "pty://data",
                                &PtyDataPayload {
                                    session_id: sid.clone(),
                                    data: text,
                                },
                            );
                        }
                    }
                }
            }
            if let Some(text) = utf8.flush() {
                let _ = app.emit(
                    "pty://data",
                    &PtyDataPayload {
                        session_id: sid.clone(),
                        data: text,
                    },
                );
            }
        });

        let wait_result = tauri::async_runtime::spawn_blocking(move || child.wait()).await;
        let _ = read_task.await;
        // registry 정리는 wait 성공/실패와 무관하게 항상 수행한다 (좀비 엔트리 방지).
        self.inputs.lock().unwrap().remove(session_id);
        // master는 registry에서 빠지며 여기서 drop되고 reader도 EOF로 끝난다
        self.masters.lock().unwrap().remove(session_id);
        let status = wait_result
            .map_err(std::io::Error::other)?
            .map_err(std::io::Error::other)?;
        Ok(status.exit_code() as i32)
    }
}

impl PortablePtyRunner {
    /// 조기 반환 경로에서 child를 best-effort로 회수한다: kill 신호를 보낸 뒤
    /// blocking wait로 좀비 프로세스가 남지 않게 한다. 결과는 정리가 목적이므로 무시한다.
    async fn reap_child(mut child: Box<dyn portable_pty::Child + Send + Sync>) {
        let _ = child.kill();
        let _ = tauri::async_runtime::spawn_blocking(move || child.wait()).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resize_master_missing_session_returns_false() {
        let reg: PtyMasterRegistry = Default::default();
        assert!(!resize_master(&reg, "없는-세션", 80, 24));
    }

    #[test]
    fn resize_master_resizes_live_master() {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let reg: PtyMasterRegistry = Default::default();
        reg.lock().unwrap().insert("s".into(), pair.master);
        assert!(resize_master(&reg, "s", 120, 40));
        let size = reg.lock().unwrap().get("s").unwrap().get_size().unwrap();
        assert_eq!((size.cols, size.rows), (120, 40));
    }

    #[test]
    fn utf8_reassembler_handles_korean_split_across_chunk_boundary() {
        let text = "안녕하세요";
        let bytes = text.as_bytes();
        let (first, rest) = bytes.split_at(4);
        let mut r = Utf8Reassembler::default();
        let mut out = r.push(first);
        out.push_str(&r.push(rest));
        assert_eq!(out, text);
        assert!(!out.contains('\u{FFFD}'));
    }

    #[test]
    fn utf8_reassembler_survives_every_split_point() {
        let text = "안녕하세요, Claude Code!";
        let bytes = text.as_bytes();
        for split_at in 0..=bytes.len() {
            let (first, rest) = bytes.split_at(split_at);
            let mut r = Utf8Reassembler::default();
            let mut out = r.push(first);
            out.push_str(&r.push(rest));
            assert_eq!(out, text, "split_at={split_at}");
        }
    }

    #[test]
    fn utf8_reassembler_flushes_truncated_tail_lossily_at_stream_end() {
        let bytes = "안녕".as_bytes();
        let (first, _tail) = bytes.split_at(4);
        let mut r = Utf8Reassembler::default();
        assert_eq!(r.push(first), "안");
        assert!(r.flush().unwrap().contains('\u{FFFD}'));
    }

    #[test]
    fn utf8_reassembler_still_replaces_genuinely_invalid_bytes() {
        let mut r = Utf8Reassembler::default();
        assert_eq!(r.push(&[b'a', 0xFF, b'b']), "a\u{FFFD}b");
    }
}
