import { describe, expect, it } from "vitest";
import { appendLog, initialRunState, runReducer } from "../runReducer";
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

  it("terminal 상태가 세션 id를 노출하고 다음 running에서 닫힌다", () => {
    let s = runReducer(initialRunState("mock-tool"), ev({ status: { kind: "terminal", sessionId: "r-pty-0" } }));
    expect(s.terminalSession).toBe("r-pty-0");
    s = runReducer(s, ev({ status: { kind: "running" } }));
    expect(s.terminalSession).toBeNull();
  });

  it("succeeded는 (stepIndex+1)/totalSteps 퍼센트 공식을 쓴다", () => {
    const s = runReducer(
      initialRunState("mock-tool"),
      ev({ stepIndex: 2, totalSteps: 4, status: { kind: "succeeded" } }),
    );
    expect(s.percent).toBe(75); // (2+1)/4 = 75%
  });

  it("의존성 설치 후 대상 detect가 와도 페이즈가 뒤로 가지 않는다", () => {
    let s = initialRunState("mock-tool");
    s = runReducer(s, ev({ recipeId: "mock-prereq", section: "install", stepIndex: 1 }));
    expect(s.phase).toBe(2);
    s = runReducer(s, ev({ recipeId: "mock-tool", section: "detect", stepIndex: 2 }));
    expect(s.phase).toBe(2); // 버그 시 1로 후퇴
  });

  it("설치 실패 뒤 마무리 이벤트가 와도 단계가 앞으로 밀리지 않는다", () => {
    // 실측 버그(2026-07-23): OpenClaw 설치가 3단계에서 실패했는데 뒤따라온 done
    // 이벤트가 phase를 4로 올려, 정작 실패한 3단계가 완료(✓)로 그려졌다.
    let s = initialRunState("mock-tool");
    s = runReducer(s, ev({ recipeId: "mock-tool", section: "install", stepIndex: 1 }));
    expect(s.phase).toBe(3);
    s = runReducer(s, ev({
      recipeId: "mock-tool",
      section: "install",
      stepIndex: 1,
      status: { kind: "failed", message: "설치 프로그램이 잘 끝나지 않았어요" },
    }));
    expect(s.phase).toBe(3);
    expect(s.error).not.toBeNull();

    s = runReducer(s, ev({
      recipeId: "mock-tool",
      section: "done",
      stepIndex: 2,
      status: { kind: "done", success: false },
    }));
    expect(s.phase).toBe(3); // 버그 시 4로 밀려서 3단계가 ✓로 보였다
    expect(s.done).toBe(true);
    expect(s.success).toBe(false);
  });

  it("성공 흐름에서는 마무리 이벤트가 단계를 4로 올린다", () => {
    let s = initialRunState("mock-tool");
    s = runReducer(s, ev({ recipeId: "mock-tool", section: "install", stepIndex: 1 }));
    s = runReducer(s, ev({
      recipeId: "mock-tool",
      section: "done",
      stepIndex: 2,
      status: { kind: "done", success: true },
    }));
    expect(s.phase).toBe(4);
    expect(s.success).toBe(true);
  });

  it("진행 이벤트의 recipeId를 currentRecipeId로 추적한다", () => {
    let s = initialRunState("mock-plugin");
    expect(s.currentRecipeId).toBe("mock-plugin");
    s = runReducer(s, ev({ recipeId: "mock-tool", status: { kind: "running" } }));
    expect(s.currentRecipeId).toBe("mock-tool");
    s = runReducer(s, ev({ recipeId: "mock-plugin", status: { kind: "running" } }));
    expect(s.currentRecipeId).toBe("mock-plugin");
  });
});

describe("appendLog", () => {
  it("최근 500줄만 남기고 앞부분을 잘라낸다", () => {
    let s = initialRunState("mock-tool");
    for (let i = 0; i < 502; i += 1) {
      s = appendLog(s, `line-${i}`);
    }
    expect(s.logs).toHaveLength(500);
    expect(s.logs[0]).toBe("line-2"); // line-0, line-1이 잘려나감
    expect(s.logs[s.logs.length - 1]).toBe("line-501");
  });
});
