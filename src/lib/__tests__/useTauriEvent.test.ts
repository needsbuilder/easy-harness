import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { mockListen } = vi.hoisted(() => ({ mockListen: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mockListen }));

import { useTauriEvent } from "../useTauriEvent";

beforeEach(() => {
  mockListen.mockReset();
});

describe("useTauriEvent", () => {
  it("listen()이 풀리기 전에 언마운트해도 unlisten이 나중에 호출된다", async () => {
    const unlisten = vi.fn();
    let resolveListen: ((fn: () => void) => void) | undefined;
    mockListen.mockImplementation(
      () => new Promise<() => void>((r) => { resolveListen = r; }),
    );

    const { unmount } = renderHook(() => useTauriEvent("catalog://updated", () => {}));
    // 효과가 마운트되며 listen()이 호출돼 resolve 핸들을 잡았어야 한다
    expect(resolveListen).toBeDefined();
    unmount();
    // listen()이 언마운트 뒤에야 resolve됐는데도 리스너가 새지 않고 곧바로 정리돼야 한다
    resolveListen!(unlisten);
    await Promise.resolve();
    await Promise.resolve();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("정상 흐름: listen이 먼저 풀리면 언마운트 때 unlisten한다", async () => {
    const unlisten = vi.fn();
    mockListen.mockResolvedValue(unlisten);

    const { unmount } = renderHook(() => useTauriEvent("catalog://updated", () => {}));
    await waitFor(() => expect(mockListen).toHaveBeenCalledTimes(1));
    unmount();

    await waitFor(() => expect(unlisten).toHaveBeenCalledTimes(1));
  });

  it("이벤트 페이로드로 핸들러를 호출한다", async () => {
    const handler = vi.fn();
    let captured: ((e: { payload: unknown }) => void) | undefined;
    mockListen.mockImplementation((_event: string, cb: (e: { payload: unknown }) => void) => {
      captured = cb;
      return Promise.resolve(() => {});
    });

    renderHook(() => useTauriEvent<number>("some://event", handler));
    await waitFor(() => expect(captured).toBeDefined());
    captured!({ payload: 42 });

    expect(handler).toHaveBeenCalledWith(42);
  });
});
