import type { ProgressEvent } from "./types";

export interface RunState {
  targetId: string;
  currentRecipeId: string;
  totalSteps: number;
  stepIndex: number;
  friendly: string;
  percent: number;
  phase: 1 | 2 | 3 | 4;
  section: string;
  logs: string[];
  error: { message: string; friendly: string } | null;
  waitingSecret: string | null;
  terminalSession: string | null;
  done: boolean;
  success: boolean;
}

export function initialRunState(targetId: string): RunState {
  return {
    targetId, currentRecipeId: targetId, totalSteps: 0, stepIndex: 0, friendly: "준비하고 있어요",
    percent: 0, phase: 1, section: "detect", logs: [], error: null, waitingSecret: null,
    terminalSession: null, done: false, success: false,
  };
}

function phaseOf(ev: ProgressEvent, targetId: string): 1 | 2 | 3 | 4 {
  if (ev.section === "detect") return 1;
  if (ev.recipeId !== targetId) return 2;
  if (ev.section === "install") return 3;
  return 4; // auth · verify · done
}

export function runReducer(state: RunState, ev: ProgressEvent): RunState {
  const percent = ev.totalSteps === 0 ? 0 : Math.round((ev.stepIndex / ev.totalSteps) * 100);
  // 실패한 뒤에도 마무리 이벤트(done 등)가 뒤따라 오는데, 그게 단계를 앞으로 밀면
  // 정작 실패한 단계가 완료(✓)로 그려진다. 실패 후에는 단계를 그 자리에 묶어 둔다.
  const phase = state.error
    ? state.phase
    : (Math.max(state.phase, phaseOf(ev, state.targetId)) as RunState["phase"]);
  const base = {
    ...state,
    currentRecipeId: ev.recipeId || state.currentRecipeId,
    totalSteps: ev.totalSteps,
    stepIndex: ev.stepIndex,
    friendly: ev.friendly,
    percent,
    phase,
    section: ev.section,
  };
  switch (ev.status.kind) {
    case "running":
      return { ...base, waitingSecret: null, terminalSession: null };
    case "succeeded":
      return { ...base, percent: Math.round(((ev.stepIndex + 1) / ev.totalSteps) * 100) };
    case "failed":
      return { ...base, error: { message: ev.status.message, friendly: ev.friendly } };
    case "waitingSecret":
      return { ...base, waitingSecret: ev.status.label };
    case "terminal":
      return { ...base, terminalSession: ev.status.sessionId };
    case "done":
      return { ...base, percent: 100, done: true, success: ev.status.success };
  }
}

export function appendLog(state: RunState, line: string): RunState {
  return { ...state, logs: [...state.logs, line].slice(-500) };
}
