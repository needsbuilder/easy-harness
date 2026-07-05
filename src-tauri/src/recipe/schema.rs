use serde::{Deserialize, Serialize};

use crate::error::EngineError;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Recipe {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub kind: ToolKind,
    pub easy_description: String,
    pub pricing: Pricing,
    #[serde(default)]
    pub supported_models: Vec<ModelBadge>,
    #[serde(default)]
    pub recommended: bool,
    #[serde(default)]
    pub requires: Vec<String>,
    pub platforms: Platforms,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolKind {
    Harness,
    Plugin,
    Prerequisite,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Pricing {
    pub label: String,
    pub kind: PricingKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PricingKind {
    Free,
    Paid,
    Freemium,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelBadge {
    pub model_label: String,
    #[serde(default)]
    pub account_label: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    Mac,
    Windows,
}

impl Platform {
    pub fn as_str(&self) -> &'static str {
        match self {
            Platform::Mac => "mac",
            Platform::Windows => "windows",
        }
    }
    /// 실행 중인 OS를 레시피 플랫폼 키로. 그 외 OS는 None (v1은 맥·윈도우만)
    pub fn current() -> Option<Platform> {
        match std::env::consts::OS {
            "macos" => Some(Platform::Mac),
            "windows" => Some(Platform::Windows),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Platforms {
    #[serde(default)]
    pub mac: Option<PlatformSpec>,
    #[serde(default)]
    pub windows: Option<PlatformSpec>,
}

impl Platforms {
    pub fn get(&self, p: Platform) -> Option<&PlatformSpec> {
        match p {
            Platform::Mac => self.mac.as_ref(),
            Platform::Windows => self.windows.as_ref(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlatformSpec {
    #[serde(default)]
    pub prerequisites: Vec<String>,
    #[serde(default)]
    pub detect: Vec<Step>,
    #[serde(default)]
    pub install: Vec<Step>,
    #[serde(default)]
    pub auth: Option<AuthSpec>,
    #[serde(default)]
    pub verify: Vec<Step>,
    #[serde(default)]
    pub update: Vec<Step>,
    #[serde(default)]
    pub uninstall: Vec<Step>,
    #[serde(default)]
    pub rollback: Vec<Step>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AuthSpec {
    pub pattern: AuthPattern,
    #[serde(default)]
    pub steps: Vec<Step>,
    /// 화면 옆에 보여줄 한국어 안내 문구 (순서대로 카드 3개)
    #[serde(default)]
    pub guide: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthPattern {
    BrowserLogin,
    ApiKey,
    InteractiveTerminal,
}

/// 주의: 내부 태그드 enum(tag="type")에는 serde 제약상 deny_unknown_fields를
/// 걸 수 없다. 모르는 "type" 값은 에러가 나지만(원하는 동작), variant 안의
/// 오타 필드는 조용히 무시될 수 있다. 레시피 필드 오타는 드라이런 테스트로 잡는다.
#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Step {
    CheckCommand {
        friendly: String,
        command: String,
        #[serde(default)]
        args: Vec<String>,
    },
    RunCommand {
        friendly: String,
        command: String,
        #[serde(default)]
        args: Vec<String>,
    },
    DownloadRun {
        friendly: String,
        url: String,
        file_name: String,
        /// 내려받은 뒤 실행할 명령. args와 command의 "{{file}}"이 파일 경로로 치환된다.
        command: String,
        #[serde(default)]
        args: Vec<String>,
    },
    OpenUrl {
        friendly: String,
        url: String,
    },
    InputSecret {
        friendly: String,
        label: String,
    },
    PtySession {
        friendly: String,
        command: String,
        #[serde(default)]
        args: Vec<String>,
    },
    PathCheck {
        friendly: String,
        path: String,
    },
}

impl Step {
    pub fn friendly(&self) -> &str {
        match self {
            Step::CheckCommand { friendly, .. }
            | Step::RunCommand { friendly, .. }
            | Step::DownloadRun { friendly, .. }
            | Step::OpenUrl { friendly, .. }
            | Step::InputSecret { friendly, .. }
            | Step::PtySession { friendly, .. }
            | Step::PathCheck { friendly, .. } => friendly,
        }
    }
    pub fn type_name(&self) -> &'static str {
        match self {
            Step::CheckCommand { .. } => "check_command",
            Step::RunCommand { .. } => "run_command",
            Step::DownloadRun { .. } => "download_run",
            Step::OpenUrl { .. } => "open_url",
            Step::InputSecret { .. } => "input_secret",
            Step::PtySession { .. } => "pty_session",
            Step::PathCheck { .. } => "path_check",
        }
    }
}

pub const SCHEMA_VERSION: u32 = 1;

impl Recipe {
    pub fn parse(json: &str) -> Result<Recipe, EngineError> {
        let recipe: Recipe = serde_json::from_str(json).map_err(|e| EngineError::RecipeParse {
            file: "<inline>".into(),
            message: e.to_string(),
        })?;
        if recipe.schema_version != SCHEMA_VERSION {
            return Err(EngineError::RecipeParse {
                file: recipe.id.clone(),
                message: format!("지원하지 않는 schemaVersion: {}", recipe.schema_version),
            });
        }
        Ok(recipe)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = r#"{
        "schemaVersion": 1,
        "id": "mock-tool",
        "name": "모의 도구",
        "kind": "harness",
        "easyDescription": "테스트용 가짜 도구예요",
        "pricing": { "label": "무료", "kind": "free" },
        "supportedModels": [ { "modelLabel": "Claude 모델", "accountLabel": "Anthropic 계정" } ],
        "recommended": true,
        "requires": [],
        "platforms": {
            "mac": {
                "prerequisites": ["mock-prereq"],
                "detect": [ { "type": "check_command", "friendly": "이미 설치돼 있는지 볼게요", "command": "mock-tool", "args": ["--version"] } ],
                "install": [ { "type": "run_command", "friendly": "모의 도구를 설치하고 있어요", "command": "echo", "args": ["install"] } ],
                "auth": {
                    "pattern": "browser_login",
                    "steps": [ { "type": "open_url", "friendly": "로그인 창을 열어 드릴게요", "url": "https://example.com/login" } ],
                    "guide": ["아래 버튼을 누르면 인터넷 창이 열려요"]
                },
                "verify": [ { "type": "check_command", "friendly": "잘 되는지 시험해 볼게요", "command": "echo", "args": ["ok"] } ],
                "update": [], "uninstall": [], "rollback": []
            },
            "windows": null
        }
    }"#;

    #[test]
    fn parses_valid_recipe() {
        let r = Recipe::parse(VALID).unwrap();
        assert_eq!(r.id, "mock-tool");
        assert_eq!(r.kind, ToolKind::Harness);
        let mac = r.platforms.get(Platform::Mac).unwrap();
        assert_eq!(mac.prerequisites, vec!["mock-prereq"]);
        assert_eq!(mac.detect[0].friendly(), "이미 설치돼 있는지 볼게요");
        assert_eq!(mac.detect[0].type_name(), "check_command");
        assert!(r.platforms.get(Platform::Windows).is_none());
        let auth = mac.auth.as_ref().unwrap();
        assert_eq!(auth.pattern, AuthPattern::BrowserLogin);
    }

    #[test]
    fn rejects_unknown_step_type() {
        let bad = VALID.replace("check_command", "teleport");
        let err = Recipe::parse(&bad).unwrap_err();
        assert!(matches!(err, EngineError::RecipeParse { .. }));
    }

    #[test]
    fn rejects_wrong_schema_version() {
        let bad = VALID.replace("\"schemaVersion\": 1", "\"schemaVersion\": 99");
        assert!(Recipe::parse(&bad).is_err());
    }

    #[test]
    fn rejects_unknown_top_level_field() {
        let bad = VALID.replacen("\"id\"", "\"surprise\": true, \"id\"", 1);
        assert!(Recipe::parse(&bad).is_err());
    }

    #[test]
    fn parses_download_run_with_command() {
        let json = r#"{
            "type": "download_run",
            "friendly": "설치 파일을 내려받아 실행하고 있어요",
            "url": "https://example.com/tool.pkg",
            "file_name": "tool.pkg",
            "command": "open",
            "args": ["-W", "{{file}}"]
        }"#;
        let step: Step = serde_json::from_str(json).unwrap();
        let Step::DownloadRun {
            command, file_name, ..
        } = &step
        else {
            panic!("DownloadRun이어야 함");
        };
        assert_eq!(command, "open");
        assert_eq!(file_name, "tool.pkg");
    }
}
