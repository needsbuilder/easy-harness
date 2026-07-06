//! 실물 레시피 전수 스펙 테스트. 각 레시피 태스크가 아래에 자기 검증을 추가한다.
use easy_harness_lib::recipe::loader::Catalog;
use easy_harness_lib::recipe::plan::{build_plan, Flow};
use easy_harness_lib::recipe::schema::{AuthPattern, Platform, Step, ToolKind};

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
            let spec = r
                .platforms
                .get(p)
                .unwrap_or_else(|| panic!("{id} {p:?} 섹션 없음"));
            assert!(!spec.detect.is_empty(), "{id} {p:?}: detect 필요");
            assert!(!spec.install.is_empty(), "{id} {p:?}: install 필요");
            assert!(spec.auth.is_none(), "{id} {p:?}: 준비물엔 auth 없음");
        }
    }
}

#[test]
fn claude_code_recipe_spec() {
    let cat = catalog();
    let r = cat.get("claude-code").expect("claude-code 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    assert!(r.recommended);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        let auth = spec.auth.as_ref().expect("auth 필요");
        assert_eq!(auth.guide.len(), 3);
        assert!(!spec.verify.is_empty());
        assert!(!spec.uninstall.is_empty());
    }
    // 준비물 없이 단독 설치 (네이티브 인스톨러라 Node 불필요)
    let plan = build_plan(&cat, "claude-code", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["claude-code"]);
}

#[test]
fn codex_recipe_spec() {
    let cat = catalog();
    let r = cat.get("codex").expect("codex 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        let auth = spec.auth.as_ref().expect("auth 필요");
        assert_eq!(auth.guide.len(), 3);
        assert!(!spec.verify.is_empty());
    }
    let plan = build_plan(&cat, "codex", Platform::Windows, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["codex"]);
}

#[test]
fn gajaecode_recipe_pulls_bun_first() {
    let cat = catalog();
    let r = cat.get("gajaecode").expect("gajaecode 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    let plan = build_plan(&cat, "gajaecode", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["bun", "gajaecode"]);
    let plan_installed = build_plan(
        &cat,
        "gajaecode",
        Platform::Mac,
        Flow::Install,
        &["bun".into()],
    )
    .unwrap();
    assert_eq!(plan_installed.tool_order, vec!["gajaecode"]);

    // gjc 0.8.1 실물 CLI에는 login·auth-broker 명령이 없다 (2026-07-06 실기 확인).
    // 실제 인증은 `gjc setup credentials --yes`(기존 도구 자격증명 자동 가져오기)이며
    // 사용자 입력이 전혀 없으므로 터미널을 띄우지 않는 automatic 패턴이어야 한다.
    for p in [Platform::Mac, Platform::Windows] {
        let auth = r
            .platforms
            .get(p)
            .unwrap()
            .auth
            .as_ref()
            .expect("auth 필요");
        assert_eq!(auth.pattern, AuthPattern::Automatic, "{p:?}");
        let joined = format!("{:?}", auth.steps);
        assert!(
            joined.contains("setup credentials --yes"),
            "{p:?}: {joined}"
        );
        assert!(!joined.contains("auth-broker"), "{p:?}: {joined}");
        assert!(
            !joined.contains("PtySession"),
            "{p:?}: 터미널 금지: {joined}"
        );
    }
}

#[test]
fn openclaw_recipe_pulls_node_first() {
    let cat = catalog();
    let r = cat.get("openclaw").expect("openclaw 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    let plan = build_plan(&cat, "openclaw", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["nodejs-lts", "openclaw"]);
}

#[test]
fn hermes_recipe_spec() {
    let cat = catalog();
    let r = cat.get("hermes").expect("hermes 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    let plan = build_plan(&cat, "hermes", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["hermes"]); // 준비물은 설치 스크립트가 자동 해결
    let mac = r.platforms.get(Platform::Mac).unwrap();
    assert_eq!(
        mac.auth.as_ref().unwrap().pattern,
        easy_harness_lib::recipe::schema::AuthPattern::BrowserLogin
    );
}

#[test]
fn opencode_recipe_spec_and_catalog_is_complete() {
    let cat = catalog();
    let r = cat.get("opencode").expect("opencode 레시피 없음");
    assert_eq!(r.kind, ToolKind::Harness);
    // windows만 npm 경로라 Node 준비물이 붙는다
    let win = build_plan(&cat, "opencode", Platform::Windows, Flow::Install, &[]).unwrap();
    assert_eq!(win.tool_order, vec!["nodejs-lts", "opencode"]);
    let mac = build_plan(&cat, "opencode", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(mac.tool_order, vec!["opencode"]);
    // 카탈로그 개수·구성 마감 검사는 M4 완결성 테스트(catalog_is_complete_after_m4)가 담당
}

#[test]
fn lazycodex_recipe_pulls_codex_and_node_first() {
    let cat = catalog();
    let r = cat.get("lazycodex").expect("lazycodex 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["codex"]);
    assert!(r.source.as_ref().unwrap().label.contains("Sisyphus"));
    let plan = build_plan(&cat, "lazycodex", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["codex", "nodejs-lts", "lazycodex"]);
    // Codex가 이미 있으면 준비물과 자신만
    let plan2 = build_plan(
        &cat,
        "lazycodex",
        Platform::Mac,
        Flow::Install,
        &["codex".into()],
    )
    .unwrap();
    assert_eq!(plan2.tool_order, vec!["nodejs-lts", "lazycodex"]);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        assert!(
            spec.auth.is_none(),
            "{p:?}: 자체 인증 없음 (Codex 인증에 얹혀감)"
        );
        assert!(!spec.verify.is_empty());
        assert!(!spec.uninstall.is_empty());
        let joined = format!("{:?}", spec.install);
        assert!(joined.contains("--no-tui"), "{p:?}: 무인 설치 플래그 필요");
        assert!(
            !joined.contains("--codex-autonomous"),
            "{p:?}: 채택 안 한 플래그"
        );
    }
}

#[test]
fn insane_search_recipe_is_mac_only_claude_plugin() {
    let cat = catalog();
    let r = cat.get("insane-search").expect("insane-search 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["claude-code"]);
    assert!(
        r.platforms.windows.is_none(),
        "윈도우는 WSL2 필수라 v1 미지원"
    );
    let plan = build_plan(&cat, "insane-search", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(plan.tool_order, vec!["claude-code", "insane-search"]);
    let mac = r.platforms.get(Platform::Mac).unwrap();
    assert!(mac.auth.is_none());
    let install = format!("{:?}", mac.install);
    assert!(
        install.contains("https://github.com/fivetaku/gptaku_plugins.git"),
        "HTTPS URL 고정"
    );
    assert!(install.contains("insane-search@gptaku-plugins"));
}

#[test]
fn korean_law_recipe_uses_api_key_pattern() {
    let cat = catalog();
    let r = cat
        .get("korean-law-mcp")
        .expect("korean-law-mcp 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["claude-code"]);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        let auth = spec.auth.as_ref().expect("api_key 인증 필요");
        assert_eq!(auth.pattern, AuthPattern::ApiKey, "{p:?}");
        assert_eq!(auth.guide.len(), 3, "{p:?}");
        let steps = format!("{:?}", auth.steps);
        assert!(steps.contains("open.law.go.kr"), "{p:?}: 발급 페이지 열기");
        assert!(steps.contains("InputSecret"), "{p:?}");
        assert!(steps.contains("law_oc"), "{p:?}: 시크릿 라벨");
        assert!(
            steps.contains("--config api_key={{secret:law_oc}}"),
            "{p:?}: 키 주입"
        );
        assert!(!steps.contains("PtySession"), "{p:?}: 터미널 금지");
    }
}

#[test]
fn im_not_ai_recipe_installs_humanize_korean_plugin() {
    let cat = catalog();
    let r = cat.get("im-not-ai").expect("im-not-ai 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["claude-code"]);
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        assert!(spec.auth.is_none(), "{p:?}");
        let install = format!("{:?}", spec.install);
        assert!(
            install.contains("https://github.com/epoko77-ai/im-not-ai.git"),
            "{p:?}"
        );
        assert!(
            install.contains("humanize-korean@im-not-ai"),
            "{p:?}: 설치 실체 이름"
        );
    }
}

#[test]
fn k_skill_recipe_uses_skills_cli_with_full_set() {
    let cat = catalog();
    let r = cat.get("k-skill").expect("k-skill 레시피 없음");
    assert_eq!(r.kind, ToolKind::Plugin);
    assert_eq!(r.requires, vec!["claude-code"]);
    let plan = build_plan(&cat, "k-skill", Platform::Mac, Flow::Install, &[]).unwrap();
    assert_eq!(
        plan.tool_order,
        vec!["claude-code", "nodejs-lts", "k-skill"]
    );
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        assert!(spec.auth.is_none(), "{p:?}");
        let install = format!("{:?}", spec.install);
        assert!(
            install.contains("skills add NomaDamas/k-skill --all -g -y -a claude-code"),
            "{p:?}"
        );
        let un = format!("{:?}", spec.uninstall);
        assert!(un.contains("skills remove"), "{p:?}");
        assert!(un.contains("lotto-results"), "{p:?}: 이름 명시 제거 목록");
        assert!(un.contains("-g -y"), "{p:?}");
    }
}

#[test]
fn bundle_built_from_recipes_dir_parses() {
    // scripts/build_recipes_bundle.sh와 같은 조립 방식이 유효함을 보증
    let dir = easy_harness_lib::recipe::loader::Catalog::bundled_dir();
    let mut recipes: Vec<serde_json::Value> = Vec::new();
    let mut names: Vec<_> = std::fs::read_dir(&dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|e| e == "json"))
        .collect();
    names.sort();
    for p in names {
        recipes.push(serde_json::from_str(&std::fs::read_to_string(p).unwrap()).unwrap());
    }
    let bundle = serde_json::json!({ "bundleVersion": 1, "recipes": recipes }).to_string();
    let (v, cat) = Catalog::from_bundle(&bundle).expect("조립한 번들이 파싱돼야 함");
    assert_eq!(v, 1);
    assert!(cat.get("claude-code").is_some());
}

#[test]
fn auth_verify_steps_check_real_login() {
    let cat = catalog();
    for (id, needle) in [
        ("codex", "codex login status"),
        ("opencode", "opencode auth list"),
        ("openclaw", "openclaw models status"),
        ("hermes", "hermes auth status nous"),
    ] {
        let r = cat.get(id).unwrap_or_else(|| panic!("{id} 레시피 없음"));
        let spec = r.platforms.get(Platform::Mac).unwrap();
        let hit = spec.verify.iter().any(|s| match s {
            Step::RunCommand { args, .. } => args.iter().any(|a| a.contains(needle)),
            _ => false,
        });
        assert!(hit, "{id}: mac verify에 인증 실검증 스텝 필요");
    }
}

#[test]
fn catalog_is_complete_after_m4() {
    let cat = catalog();
    assert_eq!(cat.recipes.len(), 13, "하네스 6 + 플러그인 5 + 준비물 2");
    let count = |k: ToolKind| cat.recipes.iter().filter(|r| r.kind == k).count();
    assert_eq!(count(ToolKind::Harness), 6);
    assert_eq!(count(ToolKind::Plugin), 5);
    assert_eq!(count(ToolKind::Prerequisite), 2);
    // 플러그인 5종 공통 계약: requires 비어 있지 않고, 제3자 오픈소스라 source 표기 필수
    for r in cat.recipes.iter().filter(|r| r.kind == ToolKind::Plugin) {
        assert!(
            !r.requires.is_empty(),
            "{}: 플러그인은 대상 하네스 필요",
            r.id
        );
        assert!(r.source.is_some(), "{}: 제작자 표기 필요", r.id);
    }
}
