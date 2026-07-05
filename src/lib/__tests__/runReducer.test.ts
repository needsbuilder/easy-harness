import { describe, expect, it } from "vitest";
import { initialRunState, runReducer } from "../runReducer";
import type { ProgressEvent } from "../types";

const ev = (over: Partial<ProgressEvent>): ProgressEvent => ({
  runId: "r", recipeId: "mock-tool", recipeName: "모의 도구", section: "install",
  stepIndex: 0, totalSteps: 4, friendly: "설치 중", status: { kind: "running" },
  ...over,
});

describe("runReducer", () => {
  it("running 이벤트가 문구·퍼센트·페이즈를 갱신한다", () => {
    let s = initialRunState("mock-tool");
    s = runReducer(s, ev({ section: "detect", stepIndex: 0 }));
    expect(s.phase).toBe(1);
    s = runReducer(s, ev({ recipeId: "mock-prereq", stepIndex: 1 }));
    expect(s.phase).toBe(2); // 다른 레시피 = 준비물
    s = runReducer(s, ev({ stepIndex: 2 }));
    expect(s.phase).toBe(3);
    expect(s.friendly).toBe("설치 중");
    expect(s.percent).toBe(50); // 2/4
  });

  it("failed는 error를, done은 완료를 기록한다", () => {
    let s = initialRunState("mock-tool");
    s = runReducer(s, ev({ status: { kind: "failed", message: "이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?" } }));
    expect(s.error?.message).toContain("다시 시도");
    s = runReducer(initialRunState("mock-tool"), ev({ stepIndex: 4, status: { kind: "done", success: true } }));
    expect(s.done).toBe(true);
    expect(s.success).toBe(true);
    expect(s.percent).toBe(100);
  });

  it("waitingSecret 라벨을 노출한다", () => {
    const s = runReducer(initialRunState("mock-tool"), ev({ status: { kind: "waitingSecret", label: "api_key" } }));
    expect(s.waitingSecret).toBe("api_key");
  });
});
