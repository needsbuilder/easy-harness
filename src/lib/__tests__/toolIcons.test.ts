import { describe, it, expect } from "vitest";
import { toolIconFor } from "../toolIcons";

describe("toolIconFor", () => {
  it("하네스는 공식 아이콘 URL을 돌려준다", () => {
    for (const id of ["claude-code", "codex", "gajaecode", "openclaw", "hermes", "opencode"]) {
      expect(toolIconFor(id), id).toBeTruthy();
    }
  });

  it("플러그인·미지원 도구는 undefined (첫 글자 폴백)", () => {
    // 오픈소스 플러그인은 공식 로고가 없어 아이콘 파일이 없다
    for (const id of ["lazycodex", "insane-search", "korean-law-mcp", "k-skill", "im-not-ai", "mock-tool"]) {
      expect(toolIconFor(id), id).toBeUndefined();
    }
  });
});
