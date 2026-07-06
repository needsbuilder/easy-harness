import { describe, expect, it } from "vitest";
import { eunNeun } from "../josa";

describe("eunNeun", () => {
  it("받침 있는 한글 끝 글자는 '은'을 고른다", () => {
    expect(eunNeun("검색")).toBe("은");
  });

  it("받침 없는 한글 끝 글자는 '는'을 고른다", () => {
    expect(eunNeun("서치")).toBe("는");
  });

  it("영문·기호가 섞여도 마지막 글자가 받침 있는 한글이면 '은'을 고른다", () => {
    expect(eunNeun("K-스킬")).toBe("은");
  });

  it("끝 글자가 한글이 아니면(영문 등) '는'으로 둔다", () => {
    expect(eunNeun("LazyCodex")).toBe("는");
  });
});
