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

    // 윈도우 실기 사고 회귀 방지 (2026-07-25 대표님 윈도우 실측):
    // 공식 install.ps1은 claude.exe를 %USERPROFILE%\.local\bin 에 넣고 **PATH에 등록하지 않는다**
    // ("Native installation exists but ...\.local\bin is not in your PATH" 를 스스로 출력한다).
    // 그래서 `claude --version` 으로 확인하면 설치가 성공했는데도 실패로 판정되고,
    // 그 오판이 rollback 을 불러 방금 설치한 claude.exe 를 지웠다. 윈도우에서 설치 자체가 불가능했다.
    let win = r.platforms.get(Platform::Windows).unwrap();
    for (section, steps) in [
        ("detect", &win.detect),
        ("install", &win.install),
        ("verify", &win.verify),
        ("update", &win.update),
    ] {
        for step in steps.iter() {
            let args = match step {
                Step::CheckCommand { args, .. } | Step::RunCommand { args, .. } => args.join(" "),
                _ => continue,
            };
            if !args.contains("claude") {
                continue; // 설치기 실행 스텝 등 claude 를 부르지 않는 스텝은 대상 아님
            }
            assert!(
                args.contains("USERPROFILE"),
                "claude-code windows [{section}]: PATH에 의존하지 말고 절대경로(.local\\bin)를 먼저 봐야 함: {args}"
            );
        }
    }
    let win_auth = win.auth.as_ref().unwrap();
    for step in &win_auth.steps {
        if let Step::PtySession { args, .. } = step {
            assert!(
                args.join(" ").contains("USERPROFILE"),
                "claude-code windows auth: 절대경로 우선이어야 함 (PATH 미등록 환경에서 로그인 불가): {:?}",
                args
            );
        }
    }
    // rollback 은 비파괴여야 한다. 확인 스텝의 false-negative 가 방금 깐 설치를 지운 전례가 있다
    // (lazycodex windows 가 같은 이유로 이미 비파괴다).
    assert!(
        win.rollback.is_empty(),
        "claude-code windows rollback 은 비파괴(빈 배열)여야 함: {:?}",
        win.rollback
    );
}

/// 인증은 전용 로그인 명령을 써야 한다. 맨 도구 이름(`claude`·`opencode`)을 그냥 실행하면
/// 채팅 TUI가 떠서, 이미 로그인된 사용자는 안내와 전혀 다른 화면을 보게 된다.
/// (실측 2026-07-23: openclaw 안내는 "Enter로 기본값"인데 실제로는 영어로 yes를 쳐야 했다.
///  도구가 온보딩 방식을 바꾸는 동안 레시피 문구만 낡는 사고가 실제로 났다.)
#[test]
fn auth_steps_use_dedicated_login_commands_not_bare_tui() {
    let cat = catalog();
    for (id, must_contain) in [("claude-code", "auth login"), ("opencode", "auth login")] {
        let r = cat.get(id).unwrap_or_else(|| panic!("{id} 레시피 없음"));
        for p in [Platform::Mac, Platform::Windows] {
            let auth = r.platforms.get(p).unwrap().auth.as_ref().unwrap();
            let ok = auth.steps.iter().any(|s| match s {
                Step::PtySession { args, .. } => args.iter().any(|a| a.contains(must_contain)),
                _ => false,
            });
            assert!(ok, "{id} {p:?}: 인증이 `{must_contain}` 을 안 쓴다");
        }
    }
}

/// rollback은 "설치하다 만 것"만 되돌려야 한다. 사용자가 원래 쓰던 설정·워크스페이스까지
/// 지우면 안 된다. `step_runner`는 인증 터미널을 사용자가 닫기만 해도(종료코드 != 0)
/// rollback을 부르므로, 여기에 전체 삭제 명령이 있으면 그게 곧 데이터 손실이다.
/// (실측 2026-07-23: openclaw rollback이 `uninstall --all`이었다.
///  `--all` = service + state + workspace + app 전부 삭제)
#[test]
fn rollback_must_not_wipe_user_data() {
    let cat = catalog();
    // 도구를 지우는 건 맞지만, 사용자 데이터까지 쓸어가는 표식이 있으면 안 된다.
    // "uninstall --yes"류 = 도구 자신의 완전 제거 명령을 rollback에 재사용하는 패턴
    // (2026-07-24 QA 스윕 🔴-2: hermes 윈도우가 이 틈으로 통과했다).
    let banned = [
        "--all",
        "rm -rf ~",
        "--reset-scope full",
        "uninstall --yes",
        "uninstall -y",
        "lazycodex-ai uninstall",
    ];
    for r in &cat.recipes {
        let id = &r.id;
        for p in [Platform::Mac, Platform::Windows] {
            let Some(spec) = r.platforms.get(p) else {
                continue;
            };
            for step in &spec.rollback {
                let args = match step {
                    Step::RunCommand { args, .. } => args.join(" "),
                    _ => continue,
                };
                for bad in banned {
                    assert!(
                        !args.contains(bad),
                        "{id} {p:?}: rollback이 사용자 데이터를 지운다 → `{bad}` in `{args}`"
                    );
                }
            }
        }
    }
}

/// harness(독립 앱) 레시피의 rollback이 도구 자신의 셀프 언인스톨 서브커맨드
/// (`<도구> uninstall ...`)를 부르면 안 된다. rollback은 "설치하다 만 흔적" 정리인데
/// 셀프 언인스톨러는 앱 전체(때로 설정·상태까지)를 지우도록 만들어져 있어 층위가 다르다.
/// 바이너리 삭제(rm -f)나 패키지 매니저 제거(npm/bun uninstall·remove)는 허용.
/// (2026-07-23 openclaw 실사고, 2026-07-24 hermes 윈도우가 같은 패턴이었다)
#[test]
fn harness_rollback_does_not_call_self_uninstaller() {
    let cat = catalog();
    for r in &cat.recipes {
        if r.kind != ToolKind::Harness {
            continue;
        }
        let id = &r.id;
        let self_uninstall = format!("{id} uninstall");
        for p in [Platform::Mac, Platform::Windows] {
            let Some(spec) = r.platforms.get(p) else {
                continue;
            };
            for step in &spec.rollback {
                let args = match step {
                    Step::RunCommand { args, .. } => args.join(" "),
                    _ => continue,
                };
                assert!(
                    !args.contains(&self_uninstall),
                    "{id} {p:?}: rollback이 셀프 언인스톨러를 부른다 → `{args}`"
                );
            }
        }
    }
}

/// 게시본(`recipes-bundle/`)이 앱에 박힌 공개키로 실제 검증되는지 확인한다.
///
/// 원격 번들은 서명이 안 맞으면 앱이 **조용히 버린다**(`remote.rs` 의 `verify_bundle(...).ok()?`).
/// 그래서 엉뚱한 키로 서명하거나 서명 후 JSON을 한 글자라도 고치면, 배포한 줄 알았는데
/// 아무에게도 도달하지 않는다. 에러도 안 뜬다. 그 사고를 CI가 막는다.
/// 또한 게시 버전이 `BUNDLED_MIN_VERSION` 미만이면 같은 이유로 무효라 함께 검사한다.
#[test]
fn published_bundle_signature_verifies_with_app_pubkey() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("레포 루트")
        .join("recipes-bundle");
    let bundle_path = root.join("recipes-bundle.json");
    let sig_path = root.join("recipes-bundle.json.sig");
    if !bundle_path.exists() {
        return; // 아직 게시본이 없는 상태면 검사 대상이 아니다
    }
    let bundle = std::fs::read(&bundle_path).expect("게시본 읽기");
    let sig = std::fs::read_to_string(&sig_path).expect("서명 읽기");
    easy_harness_lib::recipe::signing::verify_bundle(
        &bundle,
        sig.trim(),
        easy_harness_lib::recipe::signing::RECIPE_PUBKEY_B64,
    )
    .expect("게시본 서명이 앱 공개키로 검증되지 않는다. 이 상태로 푸시하면 앱이 조용히 버린다");

    // 게시 버전이 앱의 최소 요구 버전보다 낮으면 역시 조용히 무시된다.
    // BUNDLED_MIN_VERSION 은 private 이라 lib.rs 원문에서 읽는다(앱 코드를 건드리지 않기 위해).
    // 상수를 옮기거나 이름을 바꾸면 이 테스트가 먼저 깨져서 알려준다.
    let lib_src = std::fs::read_to_string(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/lib.rs"),
    )
    .expect("lib.rs 읽기");
    let min: u64 = lib_src
        .lines()
        .find_map(|l| {
            l.split_once("const BUNDLED_MIN_VERSION: u64 =")
                .map(|(_, v)| v.trim().trim_end_matches(';').to_string())
        })
        .expect("lib.rs 에서 BUNDLED_MIN_VERSION 을 못 찾았다")
        .parse()
        .expect("BUNDLED_MIN_VERSION 파싱");
    let parsed: serde_json::Value = serde_json::from_slice(&bundle).expect("게시본 JSON 파싱");
    let published = parsed["bundleVersion"]
        .as_u64()
        .expect("bundleVersion 없음");
    assert!(
        published >= min,
        "게시본 bundleVersion({published})이 BUNDLED_MIN_VERSION({min}) 미만이라 앱이 무시한다"
    );
}

/// `exit $LASTEXITCODE` 로 끝나는 PowerShell 스텝은 그 앞에 명령 존재 확인이 있어야 한다.
///
/// PowerShell 에서 없는 명령을 부르면 CommandNotFoundException 이 나는데, 이건 **문장 단위**
/// 오류라 다음 문장(`exit $LASTEXITCODE`)이 그대로 실행된다. 그리고 네이티브 프로세스가 안 떴으니
/// `$LASTEXITCODE` 는 `$null` 이고, PowerShell 의 `exit` 은 숫자가 아닌 인자를 **0으로 바꾼다.**
/// 결과: 명령이 아예 없는 상태가 **성공(exit 0)** 으로 보고된다. 러너는 0을 성공으로 받으므로
/// (`runner/mod.rs` execute_step) 아무것도 안 됐는데 초록 체크가 뜬다.
/// 실패를 조용히 성공으로 바꾸는 것이 이 제품에서 가장 나쁜 결함이라 테스트로 막는다.
/// (2026-07-25 로컬 PowerShell 7.6.4 실측: 가드 없으면 exit 0, 있으면 exit 1)
#[test]
fn powershell_exit_lastexitcode_steps_guard_command_existence() {
    let cat = catalog();
    for r in &cat.recipes {
        let id = &r.id;
        for p in [Platform::Mac, Platform::Windows] {
            let Some(spec) = r.platforms.get(p) else {
                continue;
            };
            let mut all: Vec<&Step> = Vec::new();
            for list in [
                &spec.detect,
                &spec.install,
                &spec.verify,
                &spec.update,
                &spec.uninstall,
                &spec.rollback,
            ] {
                all.extend(list.iter());
            }
            if let Some(auth) = &spec.auth {
                all.extend(auth.steps.iter());
            }
            for step in all {
                let args = match step {
                    Step::CheckCommand { args, .. }
                    | Step::RunCommand { args, .. }
                    | Step::PtySession { args, .. } => args.join(" "),
                    _ => continue,
                };
                if !args.contains("exit $LASTEXITCODE") {
                    continue;
                }
                assert!(
                    args.contains("Get-Command"),
                    "{id} {p:?}: `exit $LASTEXITCODE` 앞에 Get-Command 존재 확인이 없다. \
                     명령이 없을 때 $LASTEXITCODE가 $null이라 exit 0(거짓 성공)이 된다: {args}"
                );
            }
        }
    }
}

/// 안내 문구가 실제 화면과 어긋나면 안 된다. 없어진 조작을 안내하는 건 사고다.
#[test]
fn auth_guides_do_not_mention_removed_steps() {
    let cat = catalog();
    for (id, banned) in [
        // `claude auth login` 은 로그인만 하고 스스로 끝난다. /exit 를 칠 창이 없다.
        ("claude-code", "/exit"),
        // `opencode auth login` 은 자격증명 화면이라 /connect·/exit 둘 다 해당 없음.
        ("opencode", "/connect"),
        ("opencode", "/exit"),
    ] {
        let r = cat.get(id).unwrap_or_else(|| panic!("{id} 레시피 없음"));
        for p in [Platform::Mac, Platform::Windows] {
            let auth = r.platforms.get(p).unwrap().auth.as_ref().unwrap();
            for line in &auth.guide {
                assert!(
                    !line.contains(banned),
                    "{id} {p:?}: 안내에 이제 안 하는 조작이 남아 있다 → {line}"
                );
            }
        }
    }
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
    // rollback은 바이너리 삭제까지만. `hermes uninstall --yes`(셀프 언인스톨)를 rollback에
    // 쓰면 설치 실패가 곧 앱 제거가 된다 (2026-07-24 QA 스윕 🔴-2, 윈도우가 이 패턴이었다).
    let mac_rollback = format!("{:?}", mac.rollback);
    assert!(
        !mac_rollback.contains("hermes uninstall"),
        "hermes mac rollback이 셀프 언인스톨러를 부름: {mac_rollback}"
    );
    let win = r.platforms.get(Platform::Windows).unwrap();
    assert!(
        win.rollback.is_empty(),
        "hermes windows rollback은 비파괴(빈 배열)여야 함(실기 미검증 플랫폼): {:?}",
        win.rollback
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

    // 윈도우 경로버그 회귀 방지(2026-07-08 GitHub Actions 윈도우 러너 실측 확정):
    // lazycodex-ai는 omo를 %USERPROFILE%\.local\bin\omo.cmd 로 설치하고 .local\bin을
    // PATH에 넣지 않는다. 따라서 detect/verify는 실측된 절대경로 omo.cmd 존재 확인이어야 하고,
    // 안전장치로 windows rollback은 비파괴(빈 배열)여야 한다.
    let win = r.platforms.get(Platform::Windows).unwrap();
    let win_detect = format!("{:?}", win.detect);
    assert!(
        win_detect.contains("omo.cmd"),
        "lazycodex windows detect는 실측된 omo.cmd 절대경로 확인이어야 함: {win_detect}"
    );
    let win_verify = format!("{:?}", win.verify);
    assert!(
        win_verify.contains("omo.cmd"),
        "lazycodex windows verify는 실측된 omo.cmd 절대경로 확인이어야 함(확장자 없는 경로 금지): {win_verify}"
    );
    // 양 플랫폼 공통: rollback은 비파괴(빈 배열)여야 한다. lazycodex의 uninstall은
    // 바이너리만이 아니라 Codex 설정에 심은 훅까지 걷어내는 완전 제거라, 설치 실패
    // 시점(특히 기존 설치 위 재설치 실패)에 돌리면 잘 쓰던 설치를 지운다.
    // (2026-07-24 QA 스윕 🔴-2. 맥이 이 패턴으로 뚫려 있었다)
    for p in [Platform::Mac, Platform::Windows] {
        let spec = r.platforms.get(p).unwrap();
        assert!(
            spec.rollback.is_empty(),
            "lazycodex {p:?} rollback은 비파괴(빈 배열)여야 함: {:?}",
            spec.rollback
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
    // 니들은 mac·windows verify 둘 다에 등장하는 "로그인 살아있음" 표식으로 잡는다
    // (mac은 grep 패턴, windows는 powershell Select-String 패턴에 같은 문자열이 들어감).
    for (id, needle) in [
        ("codex", "Logged in"),
        ("claude-code", "\"loggedIn\": true"),
        ("opencode", "oauth|api"),
        ("openclaw", "missingProvidersInUse"),
        ("hermes", "logged in"),
    ] {
        let r = cat.get(id).unwrap_or_else(|| panic!("{id} 레시피 없음"));
        for p in [Platform::Mac, Platform::Windows] {
            let spec = r
                .platforms
                .get(p)
                .unwrap_or_else(|| panic!("{id} {p:?} 섹션 없음"));
            let hit = spec.verify.iter().any(|s| match s {
                Step::RunCommand { args, .. } => args.iter().any(|a| a.contains(needle)),
                _ => false,
            });
            assert!(hit, "{id} {p:?}: verify에 인증 실검증 스텝 필요");
        }
    }
}

#[test]
fn windows_verify_gates_have_exit_guard() {
    // windows verify의 인증 실검증은 powershell Select-String으로 한다.
    // Select-String -Quiet는 미매치 시에도 프로세스 종료코드를 0으로 두므로,
    // 게이트로 쓰려면 반드시 `if (-not (...)) { exit 1 }` 가드가 있어야 한다.
    let cat = catalog();
    for id in ["claude-code", "codex", "hermes", "openclaw", "opencode"] {
        let r = cat.get(id).unwrap_or_else(|| panic!("{id} 레시피 없음"));
        let win = r.platforms.get(Platform::Windows).unwrap();
        let mut found = false;
        for s in &win.verify {
            if let Step::RunCommand { args, .. } = s {
                let joined = args.join(" ");
                if joined.contains("Select-String") {
                    found = true;
                    assert!(
                        joined.contains("exit 1"),
                        "{id}: Select-String 게이트는 미매치 시 exit 1 가드가 필요: {joined}"
                    );
                }
            }
        }
        assert!(
            found,
            "{id}: windows verify에 Select-String 인증 검증 스텝 필요"
        );
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
