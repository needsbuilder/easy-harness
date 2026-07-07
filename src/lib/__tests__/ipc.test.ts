import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ProgressEvent, StepStatus } from "../types";

const { mockListen } = vi.hoisted(() => ({ mockListen: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mockListen }));

import { subscribeProgress } from "../ipc";

/** listen을 가로채, 테스트에서 임의로 이벤트를 흘려보낼 수 있는 가짜 버스. */
function makeBus() {
  let handler: ((e: { payload: unknown }) => void) | undefined;
  const unlisten = vi.fn();
  mockListen.mockImplementation((_channel: string, cb: (e: { payload: unknown }) => void) => {
    handler = cb;
    return Promise.resolve(unlisten);
  });
  return {
    emit: (payload: unknown) => handler?.({ payload }),
    unlisten,
  };
}

function ev(runId: string, status: StepStatus = { kind: "done", success: true }): ProgressEvent {
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

beforeEach(() => {
  mockListen.mockReset();
});

describe("subscribeProgress (listen-before-invoke 버퍼링)", () => {
  it("attach 전에 도착한 done 이벤트도 유실되지 않고 attach 때 전달된다", async () => {
    const bus = makeBus();
    const cb = vi.fn();
    const sub = await subscribeProgress(cb);

    // runId를 아직 모르는 사이에 done이 도착 → 버퍼링
    bus.emit(ev("run-1"));
    expect(cb).not.toHaveBeenCalled();

    sub.attach("run-1");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1" }));
  });

  it("버퍼에 다른 runId가 섞여 있어도 attach된 runId만 전달한다", async () => {
    const bus = makeBus();
    const cb = vi.fn();
    const sub = await subscribeProgress(cb);

    bus.emit(ev("run-2")); // 다른 실행의 잡음
    bus.emit(ev("run-1"));
    sub.attach("run-1");

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1" }));
  });

  it("attach 후에는 다른 runId 이벤트를 무시하고 해당 runId만 통과시킨다", async () => {
    const bus = makeBus();
    const cb = vi.fn();
    const sub = await subscribeProgress(cb);
    sub.attach("run-1");

    bus.emit(ev("run-2"));
    expect(cb).not.toHaveBeenCalled();

    bus.emit(ev("run-1", { kind: "running" }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("close가 listen을 해제한다", async () => {
    const bus = makeBus();
    const sub = await subscribeProgress(vi.fn());
    sub.close();
    expect(bus.unlisten).toHaveBeenCalledTimes(1);
  });
});
