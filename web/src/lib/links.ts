/**
 * 이지 하네스 정식 주소(canonical).
 * easyharness.vercel.app 으로 들어온 요청은 vercel.json 에서 이쪽으로 301 이동시킨다.
 * 끝에 슬래시를 붙이지 않는다(경로를 이어붙일 때 // 가 생기지 않도록).
 */
export const SITE_URL = "https://easyharness.needslab.ai";

/** GitHub 릴리스 레포(스타·소스 보기용) */
export const GITHUB_REPO = "https://github.com/needslab-ai/easy-harness-releases";

/** 사업자 정보 (사업자등록증 기준) */
export const BUSINESS = {
  name: "니즈랩(NeedsLab)",
  ceo: "권용범",
  bizNumber: "825-16-02771",
  address: "경기도 광명시 소하로 190, B동 12층 1217호",
  email: "hello@needslab.ai",
} as const;
