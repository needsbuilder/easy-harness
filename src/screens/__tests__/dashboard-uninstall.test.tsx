import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { Dashboard } from "../Dashboard";
import * as ipc from "../../lib/ipc";
import type { CatalogEntry, Installation, ProgressEvent, StepStatus } from "../../lib/types";

vi.mock("../../lib/ipc");

function inst(recipeId: string): Installation {
  return { recipeId, version: "1.0.0", installedAt: 1, authDone: true, verifiedAt: 2 };
}

function harness(overrides: Partial<CatalogEntry> & { id: string; name: string }): CatalogEntry {
  return {
    kind: "harness",
    easyDescription: "",
    pricing: { label: "무료", kind: "free" },
    supportedModels: [],
    recommended: false,
    requires: [],
    installed: false,
    installedVersion: null,
    missingRequires: [],
    platforms: ["mac", "windows"],
    available: true,
    source: null,
    ...overrides,
  };
}

function progressEvent(runId: string, status: StepStatus): ProgressEvent {
  return {
    runId,
    recipeId: "mock-tool",
    recipeName: "모의 도구",
    section: "uninstall",
    stepIndex: 0,
    totalSteps: 1,
    friendly: "정리 중",
    status,
  };
}

/** 처음엔 도구가 있다가, reload(두 번째 조회)부터는 빈 목록을 돌려준다. */
function mockStateThenEmpty() {
  let calls = 0;
  vi.mocked(ipc.getAppState).mockImplementation(async () => {
    calls += 1;
    return calls === 1 ? { installations: [inst("mock-tool")] } : { installations: [] };
  });
  vi.mocked(ipc.listCatalog).mockImplementation(async () =>
    calls <= 1 ? [harness({ id: "mock-tool", name: "모의 도구", installed: true })] : [],
  );
  return () => calls;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("내 도구 삭제 (N1: done 유실 방지)", () => {
  it("done 이벤트가 오면 지우는 중이 풀리고 목록을 다시 읽는다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const stateCalls = mockStateThenEmpty();
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    let progressCb: ((ev: ProgressEvent) => void) | undefined;
    vi.mocked(ipc.subscribeProgress).mockImplementation(async (cb) => {
      progressCb = cb;
      return { attach: vi.fn(), close: vi.fn() };
    });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "삭제" }));
    await screen.findByRole("button", { name: "지우는 중" });
    await waitFor(() => expect(progressCb).toBeDefined());

    act(() => progressCb!(progressEvent("run-1", { kind: "done", success: true })));

    await waitFor(() => expect(screen.queryByText("모의 도구")).not.toBeInTheDocument());
    expect(stateCalls()).toBeGreaterThanOrEqual(2); // 최초 + reload
  });

  it("종료 이벤트가 끝내 안 와도 90초 안전 타이머가 지우는 중을 푼다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    mockStateThenEmpty();
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    // 종료 이벤트를 절대 흘리지 않는 구독
    vi.mocked(ipc.subscribeProgress).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "삭제" }));
    await screen.findByRole("button", { name: "지우는 중" });

    // 90초 안전 타이머가 걸렸는지 확인하고, 그 콜백을 직접 실행해 90초 경과를 흉내 낸다
    await waitFor(() =>
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 90_000),
    );
    const finishCb = setTimeoutSpy.mock.calls.find((c) => c[1] === 90_000)![0] as () => void;
    act(() => finishCb());

    await waitFor(() => expect(screen.queryByText("모의 도구")).not.toBeInTheDocument());
  });
});
