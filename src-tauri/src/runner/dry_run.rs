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
pub struct DryRunReport {
    pub target_id: String,
    pub platform: String,
    pub tool_order: Vec<String>,
    pub steps: Vec<DryRunStep>,
}

pub fn dry_run(catalog: &Catalog, target_id: &str, platform: Platform) -> Result<DryRunReport, EngineError> {
    let plan = build_plan(catalog, target_id, platform, Flow::Install, &[])?;
    Ok(DryRunReport {
        target_id: plan.target_id.clone(),
        platform: platform.as_str().to_string(),
        tool_order: plan.tool_order.clone(),
        steps: plan.steps.iter().map(|p| DryRunStep {
            recipe_id: p.recipe_id.clone(),
            recipe_name: p.recipe_name.clone(),
            section: p.section.as_str().to_string(),
            step_type: p.step.type_name().to_string(),
            friendly: p.step.friendly().to_string(),
        }).collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::recipe::loader::Catalog;
    use crate::recipe::schema::Platform;

    #[test]
    fn report_lists_steps_in_dependency_order() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        let report = dry_run(&catalog, "mock-plugin", Platform::Mac).unwrap();
        assert_eq!(report.tool_order, vec!["mock-prereq", "mock-tool", "mock-plugin"]);
        assert_eq!(report.platform, "mac");
        assert!(report.steps.iter().all(|s| !s.friendly.is_empty()));
        assert_eq!(report.steps[0].step_type, "check_command");
    }

    #[test]
    fn all_bundled_recipes_dry_run_on_both_platforms() {
        let catalog = Catalog::load_dir(&Catalog::bundled_dir()).unwrap();
        assert!(!catalog.recipes.is_empty());
        for recipe in &catalog.recipes {
            for platform in [Platform::Mac, Platform::Windows] {
                let report = dry_run(&catalog, &recipe.id, platform)
                    .unwrap_or_else(|e| panic!("{} @ {:?}: {e}", recipe.id, platform));
                assert!(!report.steps.is_empty(), "{} @ {:?}: 스텝 0개", recipe.id, platform);
                for s in &report.steps {
                    assert!(!s.friendly.trim().is_empty(), "{}: friendly 빈 문구", recipe.id);
                    assert!(!s.friendly.contains('—'), "{}: 카피에 em dash 금지", recipe.id);
                }
            }
        }
    }
}
