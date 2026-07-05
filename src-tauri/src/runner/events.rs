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
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum StepStatus {
    Running,
    Succeeded,
    Failed { message: String },
    WaitingSecret { label: String },
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
