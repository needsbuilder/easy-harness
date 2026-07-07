import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLatestRelease } from "../useLatestRelease";

const body = {
  tag_name: "v0.1.2",
  assets: [
    { name: "Easy.Harness_0.1.2_aarch64.dmg", browser_download_url: "u/arm.dmg" },
    { name: "Easy.Harness_0.1.2_x64-setup.exe", browser_download_url: "u/setup.exe" },
  ],
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("useLatestRelease", () => {
  it("성공 시 picks와 version을 채운다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => body })),
    );
    const { result } = renderHook(() => useLatestRelease());
    await waitFor(() => expect(result.current.version).toBe("v0.1.2"));
    expect(result.current.picks.macArm?.url).toBe("u/arm.dmg");
    expect(result.current.picks.winExe?.url).toBe("u/setup.exe");
    expect(result.current.failed).toBe(false);
  });

  it("HTTP 실패면 failed=true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    const { result } = renderHook(() => useLatestRelease());
    await waitFor(() => expect(result.current.failed).toBe(true));
  });

  it("네트워크 예외면 failed=true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net");
      }),
    );
    const { result } = renderHook(() => useLatestRelease());
    await waitFor(() => expect(result.current.failed).toBe(true));
  });
});
