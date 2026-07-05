use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::error::EngineError;
use crate::recipe::schema::Recipe;

#[derive(Debug, Clone)]
pub struct Catalog {
    pub recipes: Vec<Recipe>,
}

impl Catalog {
    /// M2: 개발 빌드 전용 경로. 릴리스 리소스 경로·원격 갱신은 마일스톤 3에서.
    pub fn bundled_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("recipes")
    }

    /// mock 레시피 픽스처 (엔진 유닛 테스트 전용)
    pub fn fixture_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/recipes")
    }

    pub fn load_dir(dir: &Path) -> Result<Catalog, EngineError> {
        let mut recipes = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();
        let mut entries: Vec<PathBuf> = std::fs::read_dir(dir)?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().is_some_and(|x| x == "json"))
            .collect();
        entries.sort(); // 결정적 순서 (테스트·드라이런 리포트 안정성)
        for path in entries {
            let file = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let text = std::fs::read_to_string(&path)?;
            let recipe = Recipe::parse(&text).map_err(|e| match e {
                EngineError::RecipeParse { message, .. } => EngineError::RecipeParse {
                    file: file.clone(),
                    message,
                },
                other => other,
            })?;
            if !seen.insert(recipe.id.clone()) {
                return Err(EngineError::RecipeParse {
                    file,
                    message: format!("id가 겹쳐요: {}", recipe.id),
                });
            }
            recipes.push(recipe);
        }
        Ok(Catalog { recipes })
    }

    pub fn get(&self, id: &str) -> Option<&Recipe> {
        self.recipes.iter().find(|r| r.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn loads_fixture_recipes() {
        let catalog = Catalog::load_dir(&Catalog::fixture_dir()).unwrap();
        assert_eq!(catalog.recipes.len(), 3);
        assert!(catalog.get("mock-tool").is_some());
        assert!(catalog.get("no-such-id").is_none());
    }

    #[test]
    fn rejects_duplicate_ids() {
        let dir = tempfile::tempdir().unwrap();
        let src = Catalog::fixture_dir().join("mock-tool.json");
        fs::copy(&src, dir.path().join("a.json")).unwrap();
        fs::copy(&src, dir.path().join("b.json")).unwrap();
        let err = Catalog::load_dir(dir.path()).unwrap_err();
        assert!(err.to_string().contains("mock-tool"));
    }

    #[test]
    fn reports_broken_json_with_file_name() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("broken.json"), "{ not json").unwrap();
        let err = Catalog::load_dir(dir.path()).unwrap_err();
        assert!(err.to_string().contains("broken.json"));
    }
}
