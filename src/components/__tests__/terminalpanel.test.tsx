import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const write = vi.fn();
const onData = vi.fn(() => ({ dispose: vi.fn() }));
const open = vi.fn();
const disposeTerm = vi.fn();
vi.mock("@xterm/xterm", () => ({
  // vi.fn()이 `new`로 호출되려면 구현체가 화살표 함수가 아니어야 한다
  // (화살표 함수는 생성자로 쓸 수 없어 "is not a constructor"로 실패한다).
  Terminal: vi.fn(function Terminal() {
    return { open, write, onData, dispose: disposeTerm };
  }),
}));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));
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
});
