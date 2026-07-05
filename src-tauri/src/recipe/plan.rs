use serde::Serialize;

use crate::error::EngineError;
use crate::recipe::loader::Catalog;
use crate::recipe::schema::{Platform, PlatformSpec, Recipe, Step};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Section {
    Detect,
    Install,
    Auth,
    Verify,
    Update,
    Uninstall,
    Rollback,
}

impl Section {
    pub fn as_str(&self) -> &'static str {
        match self {
            Section::Detect => "detect",
            Section::Install => "install",
            Section::Auth => "auth",
            Section::Verify => "verify",
            Section::Update => "update",
            Section::Uninstall => "uninstall",
            Section::Rollback => "rollback",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flow {
    Install,
    Update,
    Uninstall,
}

#[derive(Debug, Clone)]
pub struct PlannedStep {
    pub recipe_id: String,
    pub recipe_name: String,
    pub section: Section,
    pub step: Step,
}

#[derive(Debug, Clone)]
pub struct InstallPlan {
    pub target_id: String,
    pub steps: Vec<PlannedStep>,
    pub tool_order: Vec<String>,
}

pub fn build_plan(
    catalog: &Catalog,
    target_id: &str,
    platform: Platform,
    flow: Flow,
    installed: &[String],
) -> Result<InstallPlan, EngineError> {
    let target = catalog
        .get(target_id)
        .ok_or_else(|| EngineError::UnknownRecipe(target_id.to_string()))?;

    let tool_order = match flow {
        Flow::Install => resolve_order(catalog, target, platform, installed)?,
        Flow::Update | Flow::Uninstall => vec![target_id.to_string()],
    };

    let mut steps = Vec::new();
    for id in &tool_order {
        let recipe = catalog
            .get(id)
            .ok_or_else(|| EngineError::UnknownRecipe(id.clone()))?;
        let spec = platform_spec(recipe, platform)?;
        match flow {
            Flow::Install => {
                push(&mut steps, recipe, Section::Detect, &spec.detect);
                push(&mut steps, recipe, Section::Install, &spec.install);
                if let Some(auth) = &spec.auth {
                    push(&mut steps, recipe, Section::Auth, &auth.steps);
                }
                push(&mut steps, recipe, Section::Verify, &spec.verify);
            }
            Flow::Update => push(&mut steps, recipe, Section::Update, &spec.update),
            Flow::Uninstall => push(&mut steps, recipe, Section::Uninstall, &spec.uninstall),
        }
    }
    Ok(InstallPlan {
        target_id: target_id.to_string(),
        steps,
        tool_order,
    })
}

fn push(steps: &mut Vec<PlannedStep>, recipe: &Recipe, section: Section, list: &[Step]) {
    for step in list {
        steps.push(PlannedStep {
            recipe_id: recipe.id.clone(),
            recipe_name: recipe.name.clone(),
            section,
            step: step.clone(),
        });
    }
}

fn platform_spec(recipe: &Recipe, platform: Platform) -> Result<&PlatformSpec, EngineError> {
    recipe
        .platforms
        .get(platform)
        .ok_or_else(|| EngineError::PlatformUnsupported {
            recipe: recipe.id.clone(),
            platform: platform.as_str().to_string(),
        })
}

/// DFS 후위순회. visiting 스택으로 순환 검출. installed는 서브트리째 생략.
/// prerequisites는 빌드 대상 platform의 섹션에서 읽는다 (실행 OS와 무관).
fn resolve_order(
    catalog: &Catalog,
    target: &Recipe,
    platform: Platform,
    installed: &[String],
) -> Result<Vec<String>, EngineError> {
    let mut order = Vec::new();
    let mut visiting = Vec::new();
    let mut done = Vec::new();
    visit(
        catalog,
        &target.id,
        platform,
        installed,
        &mut visiting,
        &mut done,
        &mut order,
    )?;
    Ok(order)
}

fn visit(
    catalog: &Catalog,
    id: &str,
    platform: Platform,
    installed: &[String],
    visiting: &mut Vec<String>,
    done: &mut Vec<String>,
    order: &mut Vec<String>,
) -> Result<(), EngineError> {
    if done.iter().any(|d| d == id) {
        return Ok(());
    }
    if visiting.iter().any(|v| v == id) {
        let mut cycle = visiting.clone();
        cycle.push(id.to_string());
        return Err(EngineError::DependencyCycle(cycle));
    }
    let recipe = catalog
        .get(id)
        .ok_or_else(|| EngineError::UnknownRecipe(id.to_string()))?;
    visiting.push(id.to_string());
    let mut deps: Vec<String> = recipe.requires.clone();
    let spec = platform_spec(recipe, platform)?;
    deps.extend(spec.prerequisites.clone());
    for dep in deps {
        if !installed.iter().any(|i| i == &dep) {
            visit(catalog, &dep, platform, installed, visiting, done, order)?;
        }
    }
    visiting.pop();
    done.push(id.to_string());
    order.push(id.to_string());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::loader::Catalog;
    use crate::recipe::schema::Platform;

    fn catalog() -> Catalog {
        Catalog::load_dir(&Catalog::fixture_dir()).unwrap()
    }

    #[test]
    fn plugin_plan_pulls_tool_then_prereq_first() {
        let plan =
            build_plan(&catalog(), "mock-plugin", Platform::Mac, Flow::Install, &[]).unwrap();
        assert_eq!(
            plan.tool_order,
            vec!["mock-prereq", "mock-tool", "mock-plugin"]
        );
        // 첫 스텝은 가장 깊은 의존성의 detect
        assert_eq!(plan.steps[0].recipe_id, "mock-prereq");
        assert!(matches!(plan.steps[0].section, Section::Detect));
        // target의 auth 스텝이 verify보다 앞에
        let auth_idx = plan
            .steps
            .iter()
            .position(|s| matches!(s.section, Section::Auth))
            .unwrap();
        let target_verify_idx = plan
            .steps
            .iter()
            .position(|s| s.recipe_id == "mock-plugin" && matches!(s.section, Section::Verify));
        // mock-plugin에는 auth가 없으니 auth 스텝은 mock-tool 것
        assert_eq!(plan.steps[auth_idx].recipe_id, "mock-tool");
        assert!(target_verify_idx.unwrap() > auth_idx);
    }

    #[test]
    fn installed_dependencies_are_skipped() {
        let plan = build_plan(
            &catalog(),
            "mock-plugin",
            Platform::Mac,
            Flow::Install,
            &["mock-tool".into(), "mock-prereq".into()],
        )
        .unwrap();
        assert_eq!(plan.tool_order, vec!["mock-plugin"]);
    }

    #[test]
    fn unknown_target_errors() {
        let err = build_plan(&catalog(), "ghost", Platform::Mac, Flow::Install, &[]).unwrap_err();
        assert!(matches!(err, crate::error::EngineError::UnknownRecipe(_)));
    }

    #[test]
    fn cycle_is_detected() {
        let mut cat = catalog();
        // mock-tool이 mock-plugin을 requires 하도록 조작해 순환 생성
        let tool = cat
            .recipes
            .iter_mut()
            .find(|r| r.id == "mock-tool")
            .unwrap();
        tool.requires.push("mock-plugin".into());
        let err = build_plan(&cat, "mock-plugin", Platform::Mac, Flow::Install, &[]).unwrap_err();
        assert!(matches!(err, crate::error::EngineError::DependencyCycle(_)));
    }

    #[test]
    fn update_flow_uses_only_target_update_section() {
        let plan = build_plan(&catalog(), "mock-tool", Platform::Mac, Flow::Update, &[]).unwrap();
        assert_eq!(plan.tool_order, vec!["mock-tool"]);
        assert!(plan
            .steps
            .iter()
            .all(|s| matches!(s.section, Section::Update)));
        assert!(!plan.steps.is_empty());
    }

    #[test]
    fn missing_platform_section_errors() {
        let mut cat = catalog();
        let tool = cat
            .recipes
            .iter_mut()
            .find(|r| r.id == "mock-tool")
            .unwrap();
        tool.platforms.windows = None;
        let err = build_plan(&cat, "mock-tool", Platform::Windows, Flow::Install, &[]).unwrap_err();
        assert!(matches!(
            err,
            crate::error::EngineError::PlatformUnsupported { .. }
        ));
    }
}
