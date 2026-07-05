use serde::Serialize;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub run_id: String,
    pub recipe_id: String,
    pub recipe_name: String,
    pub section: String,
    pub step_index: usize,
    pub total_steps: usize,
    pub friendly: String,
    pub status: StepStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum StepStatus {
    Running,
    Succeeded,
    Failed { message: String },
    WaitingSecret { label: String },
    Terminal { session_id: String },
    Done { success: bool },
}

pub trait ProgressEmitter: Send + Sync {
    fn progress(&self, ev: &ProgressEvent);
    fn log(&self, run_id: &str, line: &str);
}

/// 테스트용 진행 이벤트 수집기. 실제 UI 배선(Task 12)에서는 Tauri emit으로 교체된다.
#[derive(Default)]
pub struct CollectingEmitter {
    events: Mutex<Vec<ProgressEvent>>,
    logs: Mutex<Vec<String>>,
}

impl CollectingEmitter {
    pub fn events(&self) -> Vec<ProgressEvent> {
        self.events.lock().unwrap().clone()
    }
    pub fn logs(&self) -> Vec<String> {
        self.logs.lock().unwrap().clone()
    }
}

impl ProgressEmitter for CollectingEmitter {
    fn progress(&self, ev: &ProgressEvent) {
        self.events.lock().unwrap().push(ev.clone());
    }
    fn log(&self, _run_id: &str, line: &str) {
        self.logs.lock().unwrap().push(line.to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 프런트 runReducer는 status.sessionId(camelCase)를 읽는다. 열거형의
    // rename_all은 변형 이름만 바꾸고 변형 안 필드는 건드리지 않으므로,
    // 직렬화 경계가 프런트 기대와 일치하는지 여기서 고정한다.
    #[test]
    fn step_status_terminal_serializes_session_id_as_camel_case() {
        let json = serde_json::to_value(StepStatus::Terminal {
            session_id: "run-1-pty-0".into(),
        })
        .unwrap();
        assert_eq!(json["kind"], "terminal");
        assert_eq!(json["sessionId"], "run-1-pty-0");
    }
}
