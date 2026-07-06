import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { mockCheck, mockRelaunch } = vi.hoisted(() => ({
  mockCheck: vi.fn(),
  mockRelaunch: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mockCheck }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mockRelaunch }));

import { useAppUpdate } from "../appUpdate";

beforeEach(() => {
  mockCheck.mockReset();
  mockRelaunch.mockReset();
});

describe("useAppUpdate", () => {
  it("업데이트가 없으면 idle 유지", async () => {
    mockCheck.mockResolvedValue(null);
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    expect(result.current.phase.kind).toBe("idle");
  });

  it("확인 실패는 조용히 무시 (idle)", async () => {
    mockCheck.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(mockCheck).toHaveBeenCalled());
    expect(result.current.phase.kind).toBe("idle");
  });

  it("업데이트가 있으면 available, install 성공 시 진행률 후 relaunch", async () => {
    const update = {
      downloadAndInstall: vi.fn(async (cb: (e: unknown) => void) => {
        cb({ event: "Started", data: { contentLength: 100 } });
        cb({ event: "Progress", data: { chunkLength: 50 } });
        cb({ event: "Finished" });
      }),
    };
    mockCheck.mockResolvedValue(update);
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.phase.kind).toBe("available"));
    await act(() => result.current.install());
    expect(update.downloadAndInstall).toHaveBeenCalled();
    expect(mockRelaunch).toHaveBeenCalled();
  });

  it("다운로드 실패 시 failed, relaunch 안 함", async () => {
    const update = { downloadAndInstall: vi.fn().mockRejectedValue(new Error("네트워크")) };
    mockCheck.mockResolvedValue(update);
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.phase.kind).toBe("available"));
    await act(() => result.current.install());
    expect(result.current.phase.kind).toBe("failed");
    expect(mockRelaunch).not.toHaveBeenCalled();
  });
});
