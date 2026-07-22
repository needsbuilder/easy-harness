#!/usr/bin/env bash
set -euo pipefail
# 사용법: scripts/build_recipes_bundle.sh <bundleVersion> <개인키 경로>
# 개인키는 Dashlane 보안 메모에서 복원(개행 제거 44자). 절대 커밋 금지.
[ $# -eq 2 ] || { echo "사용법: $0 <bundleVersion> <개인키 경로>" >&2; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/src-tauri"
jq -n --argjson v "$1" '{bundleVersion: $v, recipes: [inputs]}' recipes/*.json > recipes-bundle.json
cargo run --features dev-tools --bin sign_recipes -- sign recipes-bundle.json "$2"

# 게시본은 레포 안 recipes-bundle/ 로 복사한다. 앱의 REMOTE_BASE 가 이 경로의 raw URL 을 본다.
# (예전엔 별도 easy-harness-recipes 레포에 올렸는데, 소스가 public 이 되면서 합쳤다)
mkdir -p "$ROOT/recipes-bundle"
cp recipes-bundle.json recipes-bundle.json.sig "$ROOT/recipes-bundle/"

echo "생성 완료: src-tauri/recipes-bundle.json(.sig)"
echo "게시본 갱신: recipes-bundle/ (커밋·푸시하면 다음 실행부터 반영됩니다)"
