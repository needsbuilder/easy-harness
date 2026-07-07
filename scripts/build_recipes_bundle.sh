#!/usr/bin/env bash
set -euo pipefail
# 사용법: scripts/build_recipes_bundle.sh <bundleVersion> <개인키 경로>
# 개인키는 Dashlane 보안 메모에서 복원(개행 제거 44자). 절대 커밋 금지.
[ $# -eq 2 ] || { echo "사용법: $0 <bundleVersion> <개인키 경로>" >&2; exit 1; }
cd "$(dirname "$0")/../src-tauri"
jq -n --argjson v "$1" '{bundleVersion: $v, recipes: [inputs]}' recipes/*.json > recipes-bundle.json
cargo run --features dev-tools --bin sign_recipes -- sign recipes-bundle.json "$2"
echo "생성 완료: src-tauri/recipes-bundle.json(.sig)"
echo "게시: easy-harness-recipes 레포 루트에 두 파일을 커밋·푸시하세요"
