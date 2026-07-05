use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::EngineError;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Installation {
    pub recipe_id: String,
    pub version: Option<String>,
    pub installed_at: u64,
    pub auth_done: bool,
    pub verified_at: Option<u64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub installations: Vec<Installation>,
}

pub fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub struct StateStore {
    path: PathBuf,
}

impl StateStore {
    pub fn new(path: PathBuf) -> Self {
        StateStore { path }
    }

    pub fn path(&self) -> &std::path::Path {
        &self.path
    }

    pub fn load(&self) -> AppState {
        let Ok(text) = std::fs::read_to_string(&self.path) else {
            return AppState::default();
        };
        match serde_json::from_str(&text) {
            Ok(state) => state,
            Err(_) => {
                // 깨진 파일은 백업해 두고 초기화 (사용자 데이터 조용히 삭제 금지)
                let _ = std::fs::rename(&self.path, self.path.with_extension("json.bak"));
                AppState::default()
            }
        }
    }

    pub fn save(&self, state: &AppState) -> Result<(), EngineError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(
            &tmp,
            serde_json::to_string_pretty(state).expect("직렬화 실패 불가"),
        )?;
        std::fs::rename(&tmp, &self.path)?; // 원자적 교체
        Ok(())
    }

    pub fn upsert(&self, item: Installation) -> Result<AppState, EngineError> {
        let mut state = self.load();
        state
            .installations
            .retain(|i| i.recipe_id != item.recipe_id);
        state.installations.push(item);
        state
            .installations
            .sort_by(|a, b| a.recipe_id.cmp(&b.recipe_id));
        self.save(&state)?;
        Ok(state)
    }

    pub fn remove(&self, recipe_id: &str) -> Result<AppState, EngineError> {
        let mut state = self.load();
        state.installations.retain(|i| i.recipe_id != recipe_id);
        self.save(&state)?;
        Ok(state)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str) -> Installation {
        Installation {
            recipe_id: id.into(),
            version: Some("1.0.0".into()),
            installed_at: now_unix(),
            auth_done: false,
            verified_at: None,
        }
    }

    #[test]
    fn load_missing_file_returns_default() {
        let dir = tempfile::tempdir().unwrap();
        let store = StateStore::new(dir.path().join("installed.json"));
        assert!(store.load().installations.is_empty());
    }

    #[test]
    fn upsert_then_reload_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let store = StateStore::new(dir.path().join("installed.json"));
        store.upsert(item("mock-tool")).unwrap();
        let mut updated = item("mock-tool");
        updated.auth_done = true;
        let state = store.upsert(updated).unwrap();
        assert_eq!(state.installations.len(), 1); // 덮어쓰기지 중복 아님
        assert!(store.load().installations[0].auth_done);
    }

    #[test]
    fn remove_deletes_entry() {
        let dir = tempfile::tempdir().unwrap();
        let store = StateStore::new(dir.path().join("installed.json"));
        store.upsert(item("a")).unwrap();
        store.upsert(item("b")).unwrap();
        let state = store.remove("a").unwrap();
        assert_eq!(state.installations.len(), 1);
        assert_eq!(state.installations[0].recipe_id, "b");
    }

    #[test]
    fn corrupted_file_backs_up_and_resets() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("installed.json");
        std::fs::write(&path, "{ 깨진 json").unwrap();
        let store = StateStore::new(path.clone());
        assert!(store.load().installations.is_empty());
        assert!(path.with_extension("json.bak").exists());
    }
}
