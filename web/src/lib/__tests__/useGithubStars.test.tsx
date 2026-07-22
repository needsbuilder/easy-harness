import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { formatStars, useGithubStars } from "../useGithubStars";

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("formatStars", () => {
  it("1000 미만은 그대로 보여준다", () => {
    expect(formatStars(0)).toBe("0");
    expect(formatStars(7)).toBe("7");
    expect(formatStars(999)).toBe("999");
  });

  it("1000 이상은 k 로 줄인다", () => {
    expect(formatStars(1000)).toBe("1k");
    expect(formatStars(1240)).toBe("1.2k");
  });

  it("10k 이상은 소수점을 떼서 길어지지 않게 한다", () => {
    expect(formatStars(12400)).toBe("12k");
  });
});

describe("useGithubStars", () => {
  it("성공하면 스타 개수를 돌려준다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ stargazers_count: 42 }) })),
    );
    const { result } = renderHook(() => useGithubStars());
    await waitFor(() => expect(result.current).toBe(42));
  });

  it("API 가 막히면 null 로 남아 화면이 깨지지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403 })));
    const { result } = renderHook(() => useGithubStars());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBeNull();
  });

  it("네트워크가 끊겨도 조용히 넘어간다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const { result } = renderHook(() => useGithubStars());
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBeNull();
  });
});
