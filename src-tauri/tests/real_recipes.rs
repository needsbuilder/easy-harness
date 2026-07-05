//! 실물 레시피 전수 스펙 테스트. 각 레시피 태스크가 아래에 자기 검증을 추가한다.
use easy_harness_lib::recipe::loader::Catalog;
use easy_harness_lib::recipe::plan::{build_plan, Flow};
use easy_harness_lib::recipe::schema::{Platform, ToolKind};

fn catalog() -> Catalog {
    Catalog::load_dir(&Catalog::bundled_dir()).unwrap()
}

#[test]
fn prerequisite_recipes_exist_on_both_platforms() {
    let cat = catalog();
    for id in ["nodejs-lts", "bun"] {
        let r = cat.get(id).unwrap_or_else(|| panic!("{id} 레시피 없음"));
        assert_eq!(r.kind, ToolKind::Prerequisite, "{id}");
        for p in [Platform::Mac, Platform::Windows] {
            let spec = r.platforms.get(p).unwrap_or_else(|| panic!("{id} {p:?} 섹션 없음"));
            assert!(!spec.detect.is_empty(), "{id} {p:?}: detect 필요");
            assert!(!spec.install.is_empty(), "{id} {p:?}: install 필요");
            assert!(spec.auth.is_none(), "{id} {p:?}: 준비물엔 auth 없음");
        }
    }
}
