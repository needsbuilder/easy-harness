import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  targetInstalled: false,
  toolOrder: ["mock-tool"],
  tools: [{ id: "mock-tool", name: "모의 도구", kind: "harness", auth: null }],
  steps: [
    { recipeId: "mock-tool", recipeName: "모의 도구", section: "install", stepType: "run", friendly: "설치 중" },
  ],
};

describe("Wizard 생명주기 (StrictMode 구독 정리)", () => {
  // 이 프로젝트는 vitest globals를 안 써서 자동 cleanup이 안 돈다. cleanup 없이는
  // 앞 테스트의 Wizard(와 그 폼)가 DOM에 남아, 뒤 테스트의 클릭이 죽은 폼에 가서
  // 조용히 무시되는 오염이 생긴다 (2026-07-24 실측).
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("StrictMode 이중 마운트에서도 구독을 dangling 없이 정리하고, 실제 언마운트 전까지는 살아있는 구독을 유지한다", async () => {
    const unlistenProgress = vi.fn();
    const unlistenLog = vi.fn();

    vi.mocked(ipc.getDryRun).mockResolvedValue(dryRun);
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.subscribeProgress).mockResolvedValue({ attach: vi.fn(), close: unlistenProgress });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: unlistenLog });

    const { unmount } = render(
      <StrictMode>
        <MemoryRouter initialEntries={["/wizard/mock-tool"]}>
          <Routes>
            <Route path="/wizard/:toolId" element={<Wizard />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );

    // 구독(subscribeProgress/subscribeLog)이 최소 1쌍은 등록될 때까지 대기.
    await waitFor(() => {
      expect(ipc.subscribeProgress).toHaveBeenCalled();
      expect(ipc.subscribeLog).toHaveBeenCalled();
    });

    // 살아있는 구독: 등록은 됐지만, 실제 unmount 전이므로 아직 정리(close)되면 안 된다.
    // StrictMode 이중 마운트에서 1차(죽은) 효과가 공유 구독을 조기에 닫아버리면
    // 이 지점에서 이미 호출돼 있으므로 실패한다.
    expect(unlistenProgress).not.toHaveBeenCalled();
    expect(unlistenLog).not.toHaveBeenCalled();

    unmount();

    // 실제 언마운트 후에는 등록된 구독 수만큼만 정리되어야 한다 (dangling 0).
    await waitFor(() => {
      expect(unlistenProgress).toHaveBeenCalledTimes(vi.mocked(ipc.subscribeProgress).mock.calls.length);
      expect(unlistenLog).toHaveBeenCalledTimes(vi.mocked(ipc.subscribeLog).mock.calls.length);
    });
    expect(vi.mocked(ipc.subscribeProgress).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(vi.mocked(ipc.subscribeLog).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("startFlow가 실패하면 이미 만든 구독을 닫아 누수를 남기지 않는다", async () => {
    const closeProgress = vi.fn();
    const closeLog = vi.fn();
    vi.mocked(ipc.getDryRun).mockResolvedValue(dryRun);
    vi.mocked(ipc.subscribeProgress).mockResolvedValue({ attach: vi.fn(), close: closeProgress });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: closeLog });
    vi.mocked(ipc.startFlow).mockRejectedValue(new Error("백엔드 거부"));

    render(
      <MemoryRouter initialEntries={["/wizard/mock-tool"]}>
        <Routes>
          <Route path="/wizard/:toolId" element={<Wizard />} />
        </Routes>
      </MemoryRouter>,
    );

    // 시작이 실패하면 에러 안내가 뜨고, 그 사이 살렸던 구독 2개는 반드시 닫혀야 한다.
    expect(await screen.findByText(/시작하지 못했어요/)).toBeInTheDocument();
    await waitFor(() => {
      expect(closeProgress).toHaveBeenCalledTimes(1);
      expect(closeLog).toHaveBeenCalledTimes(1);
    });
  });

  it("실모드로 한 번만 시작한다 (StrictMode 이중 마운트 가드)", async () => {
    vi.mocked(ipc.getDryRun).mockResolvedValue(dryRun);
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.subscribeProgress).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });

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
    vi.mocked(ipc.subscribeProgress).mockImplementation(async (cb) => {
      fireProgress = cb;
      return { attach: vi.fn(), close: vi.fn() };
    });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });
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

  it("provideSecret이 값을 거부하면 안내를 보여주고 폼 잠금을 푼다 (QA 🔴-5)", async () => {
    let fireProgress: ((ev: ProgressEvent) => void) | undefined;
    vi.mocked(ipc.getDryRun).mockResolvedValue(dryRun);
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.subscribeProgress).mockImplementation(async (cb) => {
      fireProgress = cb;
      return { attach: vi.fn(), close: vi.fn() };
    });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });
    vi.mocked(ipc.provideSecret).mockRejectedValue("쓸 수 없는 문자가 섞여 있어요. 발급받은 인증키만 다시 복사해서 붙여넣어 주세요.");

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
    // runId가 세팅된 뒤에 제출해야 한다. startFlow 호출 확인만으로는 부족하고
    // (호출 직후엔 setRunId가 아직 커밋 전이라 제출이 조용히 무시된다) 한 번 더 flush.
    await waitFor(() => expect(ipc.startFlow).toHaveBeenCalled());
    await act(async () => {});
    const input = await screen.findByLabelText(/열쇠 값/);
    fireEvent.change(input, { target: { value: "abc; rm" } });
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    await waitFor(() => expect(ipc.provideSecret).toHaveBeenCalled());

    // 거부 안내가 뜨고, 버튼이 "확인하는 중"에 영구히 잠기지 않아야 한다.
    expect(await screen.findByRole("alert")).toHaveTextContent(/쓸 수 없는 문자/);
    expect(screen.getByRole("button", { name: "등록하기" })).not.toBeDisabled();
  });

  it("선행 하네스가 체인에 있으면 안내부터 보여주고, 시작을 눌러야 설치가 시작된다", async () => {
    vi.mocked(ipc.getDryRun).mockResolvedValue({
      targetId: "lazycodex", platform: "mac", targetInstalled: false,
      toolOrder: ["codex", "nodejs-lts", "lazycodex"],
      tools: [
        { id: "codex", name: "Codex", kind: "harness", auth: { pattern: "browser_login", guide: ["a", "b", "c"] } },
        { id: "nodejs-lts", name: "Node.js", kind: "prerequisite", auth: null },
        { id: "lazycodex", name: "lazycodex", kind: "plugin", auth: null },
      ],
      steps: [{ recipeId: "lazycodex", recipeName: "lazycodex", section: "install", stepType: "run_command", friendly: "설치" }],
    });
    vi.mocked(ipc.subscribeProgress).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });

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

  it("이미 설치된 도구는 확인을 받아야 재설치를 시작한다 (QA 🔴-1 회귀 방지)", async () => {
    vi.mocked(ipc.getDryRun).mockResolvedValue({ ...dryRun, targetInstalled: true });
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.subscribeProgress).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });

    render(
      <MemoryRouter initialEntries={["/wizard/mock-tool"]}>
        <Routes>
          <Route path="/wizard/:toolId" element={<Wizard />} />
        </Routes>
      </MemoryRouter>,
    );

    // 확인 화면이 먼저 뜨고, 그동안 설치는 시작되면 안 된다.
    expect(await screen.findByText(/이미 설치돼 있는 도구예요/)).toBeInTheDocument();
    expect(ipc.startFlow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /다시 설치할게요/ }));
    await waitFor(() => expect(ipc.startFlow).toHaveBeenCalledWith("mock-tool", "install", false));
  });

  it("재설치 대상에 미설치 선행 하네스가 있으면 재설치 확인 화면이 그 목록까지 알린다", async () => {
    // lazycodex는 설치돼 있는데 의존 하네스 codex를 따로 지운 상태: targetInstalled와
    // needsPreflight가 동시에 참. 재설치 게이트가 preflight 화면을 대신하므로
    // 선행 설치·로그인 고지가 여기 없으면 사용자는 알지 못한 채 codex 로그인을 만난다.
    vi.mocked(ipc.getDryRun).mockResolvedValue({
      targetId: "lazycodex", platform: "mac", targetInstalled: true,
      toolOrder: ["codex", "lazycodex"],
      tools: [
        { id: "codex", name: "Codex", kind: "harness", auth: { pattern: "browser_login", guide: ["a", "b", "c"] } },
        { id: "lazycodex", name: "lazycodex", kind: "plugin", auth: null },
      ],
      steps: [],
    });
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.subscribeProgress).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });

    render(
      <MemoryRouter initialEntries={["/wizard/lazycodex"]}>
        <Routes>
          <Route path="/wizard/:toolId" element={<Wizard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/이미 설치돼 있는 도구예요/)).toBeInTheDocument();
    expect(screen.getByText(/Codex 설치하고 로그인하기/)).toBeInTheDocument();
    expect(ipc.startFlow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /다시 설치할게요/ }));
    await waitFor(() => expect(ipc.startFlow).toHaveBeenCalledWith("lazycodex", "install", false));
  });

  it("재설치 대상에 준비물이 딸려 있으면 그 사실도 알린다 (준비물만 미설치인 경우 포함)", async () => {
    // 하네스는 다 있고 Node.js만 없는 상태: 하네스 목록은 안 뜨지만 준비물 설치는
    // 같은 런에서 돌기 때문에 고지가 있어야 한다.
    vi.mocked(ipc.getDryRun).mockResolvedValue({
      targetId: "lazycodex", platform: "mac", targetInstalled: true,
      toolOrder: ["nodejs-lts", "lazycodex"],
      tools: [
        { id: "nodejs-lts", name: "Node.js", kind: "prerequisite", auth: null },
        { id: "lazycodex", name: "lazycodex", kind: "plugin", auth: null },
      ],
      steps: [],
    });
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.subscribeProgress).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });

    render(
      <MemoryRouter initialEntries={["/wizard/lazycodex"]}>
        <Routes>
          <Route path="/wizard/:toolId" element={<Wizard />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/이미 설치돼 있는 도구예요/)).toBeInTheDocument();
    expect(screen.getByText(/필요한 준비물도 함께 챙겨요/)).toBeInTheDocument();
    expect(ipc.startFlow).not.toHaveBeenCalled();
  });

  it("선행 하네스가 없으면 안내 없이 바로 시작한다", async () => {
    vi.mocked(ipc.getDryRun).mockResolvedValue({
      targetId: "claude-code", platform: "mac", targetInstalled: false, toolOrder: ["claude-code"],
      tools: [{ id: "claude-code", name: "Claude Code", kind: "harness", auth: null }],
      steps: [],
    });
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.subscribeProgress).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });

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
      targetId: "lazycodex", platform: "mac", targetInstalled: false, toolOrder: ["codex", "lazycodex"],
      tools: [
        { id: "codex", name: "Codex", kind: "harness", auth: { pattern: "browser_login", guide: ["c1", "c2", "c3"] } },
        { id: "lazycodex", name: "lazycodex", kind: "plugin", auth: null },
      ],
      steps: [],
    });
    vi.mocked(ipc.startFlow).mockResolvedValue("run-1");
    vi.mocked(ipc.subscribeProgress).mockImplementation(async (cb) => {
      fireProgress = cb;
      return { attach: vi.fn(), close: vi.fn() };
    });
    vi.mocked(ipc.subscribeLog).mockResolvedValue({ attach: vi.fn(), close: vi.fn() });
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
