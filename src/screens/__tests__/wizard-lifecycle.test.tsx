import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { Wizard } from "../Wizard";
import * as ipc from "../../lib/ipc";
import type { DryRunReport } from "../../lib/types";

vi.mock("../../lib/ipc");

const dryRun: DryRunReport = {
  targetId: "mock-tool",
  platform: "mac",
  toolOrder: ["mock-tool"],
  steps: [
    { recipeId: "mock-tool", recipeName: "모의 도구", section: "install", stepType: "run", friendly: "설치 중" },
  ],
};

describe("Wizard 생명주기 (StrictMode 구독 정리)", () => {
  afterEach(() => vi.clearAllMocks());

  it("StrictMode 이중 마운트에서도 구독을 dangling 없이 정리하고, 실제 언마운트 전까지는 살아있는 구독을 유지한다", async () => {
    const unlistenProgress = vi.fn();
    const unlistenLog = vi.fn();

    vi.mocked(ipc.getDryRun).mockResolvedValue(dryRun);
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.onProgress).mockResolvedValue(unlistenProgress);
    vi.mocked(ipc.onLog).mockResolvedValue(unlistenLog);

    const { unmount } = render(
      <StrictMode>
        <MemoryRouter initialEntries={["/wizard/mock-tool"]}>
          <Routes>
            <Route path="/wizard/:toolId" element={<Wizard />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );

    // 구독(onProgress/onLog)이 최소 1쌍은 등록될 때까지 대기.
    await waitFor(() => {
      expect(ipc.onProgress).toHaveBeenCalled();
      expect(ipc.onLog).toHaveBeenCalled();
    });

    // 살아있는 구독: 등록은 됐지만, 실제 unmount 전이므로 아직 정리(unlisten)되면 안 된다.
    // 버그 버전(started ref)에서는 1차 start()의 구독이 체인된 cleanup에 의해
    // 등록 직후 곧바로 해제되어 이 지점에서 이미 호출돼 있으므로 실패한다.
    expect(unlistenProgress).not.toHaveBeenCalled();
    expect(unlistenLog).not.toHaveBeenCalled();

    unmount();

    // 실제 언마운트 후에는 등록된 구독 수만큼만 정리되어야 한다 (dangling 0).
    await waitFor(() => {
      expect(unlistenProgress).toHaveBeenCalledTimes(vi.mocked(ipc.onProgress).mock.calls.length);
      expect(unlistenLog).toHaveBeenCalledTimes(vi.mocked(ipc.onLog).mock.calls.length);
    });
    expect(vi.mocked(ipc.onProgress).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(vi.mocked(ipc.onLog).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
