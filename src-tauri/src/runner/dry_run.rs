use serde::Serialize;

use crate::error::EngineError;
use crate::recipe::loader::Catalog;
use crate::recipe::plan::{build_plan, Flow};
use crate::recipe::schema::Platform;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRunStep {
    pub recipe_id: String,
    pub recipe_name: String,
    pub section: String,
    pub step_type: String,
    pub friendly: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRunAuth {
    pub pattern: String,
    pub guide: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRunTool {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub auth: Option<DryRunAuth>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DryRunReport {
    pub target_id: String,
    pub platform: String,
    pub tool_order: Vec<String>,
    pub tools: Vec<DryRunTool>,
    pub steps: Vec<DryRunStep>,
}

fn auth_of(catalog: &Catalog, id: &str, platform: Platform) -> Option<DryRunAuth> {
    catalog
        .get(id)
        .and_then(|r| r.platforms.get(platform))
        .and_then(|spec| spec.auth.as_ref())
        .map(|a| DryRunAuth {
            pattern: match a.pattern {
                crate::recipe::schema::AuthPattern::BrowserLogin => "browser_login",
                crate::recipe::schema::AuthPattern::ApiKey => "api_key",
                crate::recipe::schema::AuthPattern::InteractiveTerminal => "interactive_terminal",
                crate::recipe::schema::AuthPattern::Automatic => "automatic",
            }
            .to_string(),
            guide: a.guide.clone(),
        })
}

pub fn dry_run(
    catalog: &Catalog,
    target_id: &str,
    platform: Platform,
    installed: &[String],
) -> Result<DryRunReport, EngineError> {
    let plan = build_plan(catalog, target_id, platform, Flow::Install, installed)?;
    let tools = plan
        .tool_order
        .iter()
        .map(|id| {
            let r = catalog.get(id).expect("plan에 있으면 카탈로그에 있음");
            DryRunTool {
                id: r.id.clone(),
                name: r.name.clone(),
                kind: r.kind.as_str().to_string(),
                auth: auth_of(catalog, id, platform),
            }
        })
        .collect();
    Ok(DryRunReport {
        target_id: plan.target_id.clone(),
        platform: platform.as_str().to_string(),
        tool_order: plan.tool_order.clone(),
        tools,
        steps: plan
            .steps
            .iter()
            .map(|p| DryRunStep {
                recipe_id: p.recipe_id.clone(),
                recipe_name: p.recipe_name.clone(),
                section: p.section.as_str().to_string(),
                step_type: p.step.type_name().to_string(),
                friendly: p.step.friendly().to_string(),
            })
            .collect(),
    })
}

/// 카피 기계 검사: 빈 문자열, em dash, 이모지 금지.
/// friendly뿐 아니라 레시피 name·easyDescription·auth.guide 전부에 적용한다.
#[cfg(test)]
fn assert_copy_ok(recipe_id: &str, text: &str) {
    assert!(!text.trim().is_empty(), "{recipe_id}: 빈 카피");
    assert!(
        !text.contains('—'),
        "{recipe_id}: 카피에 em dash 금지: {text}"
    );
    assert!(
        !text.chars().any(|c| {
            let cp = c as u32;
            (0x1F300..=0x1FAFF).contains(&cp) // 이모지 블록
                || (0x2600..=0x27BF).contains(&cp) // 기타 기호와 딩벳
                || cp == 0xFE0F // 변형 선택자
        }),
        "{recipe_id}: 카피에 이모지 금지: {text}"
    );
}

/// 카탈로그 전수 드라이런 + 카피 기계 검사.
/// 각 레시피가 선언한 플랫폼마다 드라이런이 성공하고 스텝이 비지 않는지,
/// 스텝 friendly·레시피 name·easyDescription·auth.guide 카피가 전부 규칙을 지키는지 확인한다.
/// (auth 접근이 필요해 dry_run 리포트가 아니라 레시피 원본을 순회하는 별도 루프로 작성)
#[cfg(test)]
fn assert_catalog_dry_runs_cleanly(catalog: &Catalog) {
    for recipe in &catalog.recipes {
        assert_copy_ok(&recipe.id, &recipe.name);
        assert_copy_ok(&recipe.id, &recipe.easy_description);

        let declared = [
            (Platform::Mac, recipe.platforms.mac.as_ref()),
            (Platform::Windows, recipe.platforms.windows.as_ref()),
        ];
        assert!(
            declared.iter().any(|(_, spec)| spec.is_some()),
            "{}: 플랫폼 섹션이 하나도 없어요",
            recipe.id
        );
        for (platform, spec) in declared {
            let Some(spec) = spec else { continue };
            if let Some(auth) = &spec.auth {
                for g in &auth.guide {
                    assert_copy_ok(&recipe.id, g);
                }
            }
            let report = dry_run(catalog, &recipe.id, platform, &[])
                .unwrap_or_else(|e| panic!("{} @ {:?}: {e}", recipe.id, platform));
            assert!(
                !report.steps.is_empty(),
                "{} @ {:?}: 스텝 0개",
                recipe.id,
                platform
            );
            for s in &report.steps {
                assert_copy_ok(&recipe.id, &s.friendly);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::loader::Catalog;
    use crate::recipe::schema::Platform;

    #[test]
    fn report_carries_per_tool_auth_in_chain() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let report = dry_run(&catalog, "mock-plugin", Platform::Mac, &[]).unwrap();
        assert_eq!(
            report.tool_order,
            vec!["mock-prereq", "mock-tool", "mock-plugin"]
        );
        let ids: Vec<&str> = report.tools.iter().map(|t| t.id.as_str()).collect();
        assert_eq!(ids, vec!["mock-prereq", "mock-tool", "mock-plugin"]);
        let kinds: Vec<&str> = report.tools.iter().map(|t| t.kind.as_str()).collect();
        assert_eq!(kinds, vec!["prerequisite", "harness", "plugin"]);
        // 체인 중간(mock-tool)의 인증이 실려 온다
        let tool = report.tools.iter().find(|t| t.id == "mock-tool").unwrap();
        let auth = tool.auth.as_ref().expect("mock-tool 인증 있어야 함");
        assert_eq!(auth.pattern, "browser_login");
        assert_eq!(auth.guide.len(), 3);
        // 플러그인 자신은 auth 없음
        assert!(report
            .tools
            .iter()
            .find(|t| t.id == "mock-plugin")
            .unwrap()
            .auth
            .is_none());
    }

    #[test]
    fn installed_dependencies_are_excluded_from_report() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let installed = vec!["mock-tool".to_string(), "mock-prereq".to_string()];
        let report = dry_run(&catalog, "mock-plugin", Platform::Mac, &installed).unwrap();
        assert_eq!(report.tool_order, vec!["mock-plugin"]);
        assert_eq!(report.tools.len(), 1);
    }

    #[test]
    fn report_lists_steps_in_dependency_order() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        let report = dry_run(&catalog, "mock-plugin", Platform::Mac, &[]).unwrap();
        assert_eq!(
            report.tool_order,
            vec!["mock-prereq", "mock-tool", "mock-plugin"]
        );
        assert_eq!(report.platform, "mac");
        assert!(report.steps.iter().all(|s| !s.friendly.is_empty()));
        assert_eq!(report.steps[0].step_type, "check_command");
    }

    #[test]
    fn all_bundled_recipes_dry_run_on_declared_platforms() {
        // 실물 레시피가 들어오기 전엔 빈 디렉토리라 루프가 그냥 통과한다.
        // 실물 레시피의 개수 검사는 Task 6의 real_recipes.rs가 담당한다.
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        assert_catalog_dry_runs_cleanly(&catalog);
    }

    #[test]
    fn fixture_recipes_dry_run_cleanly_with_copy_checks() {
        // bundled_dir가 real_recipes 도착 전까지 비어 있는 동안에도 카피 기계 검사
        // (이모지·em dash 금지, auth 가이드 포함)가 실제로 동작함을 mock 픽스처로 보장한다.
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        assert_catalog_dry_runs_cleanly(&catalog);
    }
}
