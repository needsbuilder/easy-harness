import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const write = vi.fn();
const onData = vi.fn(() => ({ dispose: vi.fn() }));
const open = vi.fn();
const disposeTerm = vi.fn();
const loadAddon = vi.fn();
vi.mock("@xterm/xterm", () => ({
  // vi.fn()이 `new`로 호출되려면 구현체가 화살표 함수가 아니어야 한다
  // (화살표 함수는 생성자로 쓸 수 없어 "is not a constructor"로 실패한다).
  Terminal: vi.fn(function Terminal() {
    return { open, write, onData, dispose: disposeTerm, loadAddon, cols: 87, rows: 24 };
  }),
}));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));
const fit = vi.fn();
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn(function FitAddon() {
    return { fit };
  }),
}));
vi.mock("../../lib/ipc");

import * as ipc from "../../lib/ipc";
import { TerminalPanel } from "../TerminalPanel";

describe("TerminalPanel", () => {
  afterEach(() => vi.clearAllMocks());

  it("pty 데이터를 터미널에 쓰고 언마운트 시 구독과 터미널을 정리한다", async () => {
    let fire: ((data: string) => void) | undefined;
    const unlisten = vi.fn();
    vi.mocked(ipc.onPtyData).mockImplementation(async (_sessionId, cb) => {
      fire = cb;
      return unlisten;
    });

    const { unmount } = render(<TerminalPanel sessionId="r-pty-0" />);
    await vi.waitFor(() =>
      expect(ipc.onPtyData).toHaveBeenCalledWith("r-pty-0", expect.any(Function)),
    );
    fire?.("hello");
    expect(write).toHaveBeenCalledWith("hello");

    unmount();
    expect(unlisten).toHaveBeenCalled();
    expect(disposeTerm).toHaveBeenCalled();
  });

  it("onPtyData resolve 전에 unmount해도 resolve 후 unlisten이 호출된다 (구독 등록 레이스 정리)", async () => {
    const unlisten = vi.fn();
    let resolveOnPtyData!: (un: () => void) => void;
    vi.mocked(ipc.onPtyData).mockImplementation(
      () => new Promise((resolve) => { resolveOnPtyData = resolve; }),
    );

    const { unmount } = render(<TerminalPanel sessionId="r-pty-race" />);
    await vi.waitFor(() =>
      expect(ipc.onPtyData).toHaveBeenCalledWith("r-pty-race", expect.any(Function)),
    );

    // 등록 Promise가 아직 resolve되기 전에 언마운트한다.
    unmount();
    expect(unlisten).not.toHaveBeenCalled();

    // 언마운트 이후에 등록이 뒤늦게 resolve되면, cancelled 가드가 즉시 unlisten을 호출해야 한다
    // (버그 버전에서는 이 시점에 unlisten이 절대 호출되지 않아 리스너가 리크된다).
    resolveOnPtyData(unlisten);
    await vi.waitFor(() => expect(unlisten).toHaveBeenCalled());
  });

  it("컨테이너에 맞춰 fit하고 그 칸수를 PTY에 알리며, 컨테이너 크기가 바뀌면 다시 맞춘다", async () => {
    // jsdom엔 ResizeObserver가 없다. 콜백을 붙잡아 크기 변화를 흉내 낸다.
    let roCb: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          roCb = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.mocked(ipc.onPtyData).mockResolvedValue(vi.fn());

    render(<TerminalPanel sessionId="r-pty-fit" />);
    // 고정 100칸이 아니라 FitAddon으로 컨테이너에 맞추고,
    // 맞춘 크기(mock 터미널은 87x24)를 백엔드 PTY에도 전달해야 한다.
    expect(loadAddon).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(ipc.ptyResize).toHaveBeenCalledWith("r-pty-fit", 87, 24),
    );
    const fitCalls = fit.mock.calls.length;
    roCb?.();
    await vi.waitFor(() => expect(fit.mock.calls.length).toBeGreaterThan(fitCalls));
    vi.unstubAllGlobals();
  });
});
