import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { Wizard } from "../Wizard";
import * as ipc from "../../lib/ipc";
import type { DryRunReport, ProgressEvent } from "../../lib/types";

vi.mock("../../lib/ipc");
// terminal 상태에서 실제 TerminalPanel(xterm)이 렌더되는데, jsdom엔 xterm이 기대하는
// matchMedia·canvas가 없어 그대로 두면 깨진다. terminalpanel.test.tsx와 같은 방식으로 목 처리.
vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn(function Terminal() {
    return { open: vi.fn(), write: vi.fn(), onData: vi.fn(() => ({ dispose: vi.fn() })), dispose: vi.fn(), loadAddon: vi.fn(), cols: 87, rows: 24 };
  }),
}));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn(function FitAddon() {
    return { fit: vi.fn() };
  }),
}));

const dryRun: DryRunReport = {
  targetId: "mock-tool",
  platform: "mac",
  toolOrder: ["mock-tool"],
  tools: [{ id: "mock-tool", name: "모의 도구", kind: "harness", auth: null }],
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

  it("실모드로 한 번만 시작한다 (StrictMode 이중 마운트 가드)", async () => {
    vi.mocked(ipc.getDryRun).mockResolvedValue(dryRun);
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.onProgress).mockResolvedValue(vi.fn());
    vi.mocked(ipc.onLog).mockResolvedValue(vi.fn());

    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/wizard/mock-tool"]}>
          <Routes>
            <Route path="/wizard/:toolId" element={<Wizard />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );
    await waitFor(() => expect(ipc.startFlow).toHaveBeenCalled());
    expect(vi.mocked(ipc.startFlow)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(ipc.startFlow)).toHaveBeenCalledWith("mock-tool", "install", false);
  });

  it("waitingSecret에서 비밀값 폼을 띄우고 제출을 provideSecret으로 잇는다", async () => {
    let fireProgress: ((ev: ProgressEvent) => void) | undefined;
    vi.mocked(ipc.getDryRun).mockResolvedValue({
      ...dryRun,
      tools: [
        { id: "mock-tool", name: "모의 도구", kind: "harness", auth: { pattern: "api_key", guide: ["발급 페이지에서 열쇠를 복사하세요"] } },
      ],
    });
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.onProgress).mockImplementation(async (_runId, cb) => {
      fireProgress = cb;
      return vi.fn(() => {});
    });
    vi.mocked(ipc.onLog).mockResolvedValue(vi.fn());
    vi.mocked(ipc.provideSecret).mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/wizard/mock-tool"]}>
        <Routes>
          <Route path="/wizard/:toolId" element={<Wizard />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(fireProgress).toBeDefined());
    act(() =>
      fireProgress!({
        runId: "run-1", recipeId: "mock-tool", recipeName: "모의 도구", section: "auth",
        stepIndex: 0, totalSteps: 2, friendly: "열쇠를 넣어 주세요",
        status: { kind: "waitingSecret", label: "api_key" },
      }),
    );
    const input = await screen.findByLabelText(/열쇠 값/);
    fireEvent.change(input, { target: { value: "sk-1" } });
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(ipc.provideSecret).toHaveBeenCalledWith("run-1", "api_key", "sk-1");
  });

  it("선행 하네스가 체인에 있으면 안내부터 보여주고, 시작을 눌러야 설치가 시작된다", async () => {
    vi.mocked(ipc.getDryRun).mockResolvedValue({
      targetId: "lazycodex", platform: "mac",
      toolOrder: ["codex", "nodejs-lts", "lazycodex"],
      tools: [
        { id: "codex", name: "Codex", kind: "harness", auth: { pattern: "browser_login", guide: ["a", "b", "c"] } },
        { id: "nodejs-lts", name: "Node.js", kind: "prerequisite", auth: null },
        { id: "lazycodex", name: "lazycodex", kind: "plugin", auth: null },
      ],
      steps: [{ recipeId: "lazycodex", recipeName: "lazycodex", section: "install", stepType: "run_command", friendly: "설치" }],
    });
    vi.mocked(ipc.onProgress).mockResolvedValue(vi.fn());
    vi.mocked(ipc.onLog).mockResolvedValue(vi.fn());

    render(
      <MemoryRouter initialEntries={["/wizard/lazycodex"]}>
        <Routes>
          <Route path="/wizard/:toolId" element={<Wizard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/먼저 챙길 게 있어요/)).toBeInTheDocument();
    expect(screen.getByText(/Codex 설치하고 로그인하기/)).toBeInTheDocument();
    expect(ipc.startFlow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /좋아요, 시작할게요/ }));
    await waitFor(() => expect(ipc.startFlow).toHaveBeenCalledWith("lazycodex", "install", false));
  });

  it("선행 하네스가 없으면 안내 없이 바로 시작한다", async () => {
    vi.mocked(ipc.getDryRun).mockResolvedValue({
      targetId: "claude-code", platform: "mac", toolOrder: ["claude-code"],
      tools: [{ id: "claude-code", name: "Claude Code", kind: "harness", auth: null }],
      steps: [],
    });
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.onProgress).mockResolvedValue(vi.fn());
    vi.mocked(ipc.onLog).mockResolvedValue(vi.fn());

    render(
      <MemoryRouter initialEntries={["/wizard/claude-code"]}>
        <Routes>
          <Route path="/wizard/:toolId" element={<Wizard />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(ipc.startFlow).toHaveBeenCalled());
    expect(screen.queryByText(/먼저 챙길 게 있어요/)).not.toBeInTheDocument();
  });

  it("체인 진행 중에는 지금 진행 중인 도구의 인증 카드로 전환된다", async () => {
    let fireProgress: ((ev: ProgressEvent) => void) | undefined;
    vi.mocked(ipc.getDryRun).mockResolvedValue({
      targetId: "lazycodex", platform: "mac", toolOrder: ["codex", "lazycodex"],
      tools: [
        { id: "codex", name: "Codex", kind: "harness", auth: { pattern: "browser_login", guide: ["c1", "c2", "c3"] } },
        { id: "lazycodex", name: "lazycodex", kind: "plugin", auth: null },
      ],
      steps: [],
    });
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.onProgress).mockImplementation(async (_runId, cb) => {
      fireProgress = cb;
      return vi.fn(() => {});
    });
    vi.mocked(ipc.onLog).mockResolvedValue(vi.fn());
    vi.mocked(ipc.onPtyData).mockResolvedValue(vi.fn());

    render(
      <MemoryRouter initialEntries={["/wizard/lazycodex"]}>
        <Routes>
          <Route path="/wizard/:toolId" element={<Wizard />} />
        </Routes>
      </MemoryRouter>,
    );

    // codex(harness)가 체인에 있으니 먼저 사전 안내가 뜨고, 확인해야 진행된다.
    await screen.findByText(/먼저 챙길 게 있어요/);
    fireEvent.click(screen.getByRole("button", { name: /좋아요, 시작할게요/ }));
    await waitFor(() => expect(fireProgress).toBeDefined());

    act(() =>
      fireProgress!({
        runId: "run-1", recipeId: "codex", recipeName: "Codex", section: "auth",
        stepIndex: 0, totalSteps: 4, friendly: "로그인해 주세요",
        status: { kind: "terminal", sessionId: "term-1" },
      }),
    );
    expect(await screen.findByText("c1")).toBeInTheDocument();

    act(() =>
      fireProgress!({
        runId: "run-1", recipeId: "lazycodex", recipeName: "lazycodex", section: "install",
        stepIndex: 1, totalSteps: 4, friendly: "설치 중",
        status: { kind: "running" },
      }),
    );
    await waitFor(() => expect(screen.queryByText("c1")).not.toBeInTheDocument());
  });
});
