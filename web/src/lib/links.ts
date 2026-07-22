/**
 * 이지 하네스 정식 주소(canonical).
 * easyharness.vercel.app 으로 들어온 요청은 vercel.json 에서 이쪽으로 301 이동시킨다.
 * 끝에 슬래시를 붙이지 않는다(경로를 이어붙일 때 // 가 생기지 않도록).
 */
export const SITE_URL = "https://easyharness.needslab.ai";

/**
 * 소스 저장소. 2026-07-22 Apache-2.0 오픈소스로 공개했다.
 * 예전엔 릴리스 레포(easy-harness-releases)를 가리켰는데, 스타는 소스 쪽에 쌓여야 의미가 있다.
 * 다운로드 링크는 releases.ts 가 따로 들고 있다.
 */
export const GITHUB_REPO = "https://github.com/needslab-ai/easy-harness";

/** 스타 개수를 물어볼 곳. 인증 없이 호출 가능하다 */
export const GITHUB_REPO_API = "https://api.github.com/repos/needslab-ai/easy-harness";

/** 새 도구 추가 요청 이슈를 바로 여는 링크 */
export const GITHUB_NEW_TOOL_ISSUE =
  "https://github.com/needslab-ai/easy-harness/issues/new?template=new-tool.yml";

/** 기여 가이드 */
export const GITHUB_CONTRIBUTING =
  "https://github.com/needslab-ai/easy-harness/blob/main/CONTRIBUTING.md";

/** 사업자 정보 (사업자등록증 기준) */
export const BUSINESS = {
  name: "니즈랩(NeedsLab)",
  ceo: "권용범",
  bizNumber: "825-16-02771",
  address: "경기도 광명시 소하로 190, B동 12층 1217호",
  email: "hello@needslab.ai",
} as const;
