import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AppState, CatalogEntry, DryRunReport, EnvReport, FlowKind, ProgressEvent,
} from "./types";

export const getEnvReport = () => invoke<EnvReport>("get_env_report");
export const listCatalog = () => invoke<CatalogEntry[]>("list_catalog");
export const getDryRun = (toolId: string) => invoke<DryRunReport>("get_dry_run", { toolId });
export const getAppState = () => invoke<AppState>("get_app_state");
export const provideSecret = (runId: string, label: string, value: string) =>
  invoke<void>("provide_secret", { runId, label, value });
export const startFlow = (toolId: string, flow: FlowKind, demo: boolean) =>
  invoke<string>("start_flow", { toolId, flow, demo });
export const ptyInput = (sessionId: string, data: string) =>
  invoke<void>("pty_input", { sessionId, data });
export const ptyResize = (sessionId: string, cols: number, rows: number) =>
  invoke<void>("pty_resize", { sessionId, cols, rows });
export const exportDiagnostics = () => invoke<string>("export_diagnostics");

export interface RunSubscription {
  /** startFlow가 runId를 돌려준 뒤 호출한다. 버퍼에 쌓인 이벤트를 흘리고, 이후엔 이 runId만 통과시킨다. */
  attach(runId: string): void;
  /** 리스너를 해제한다. */
  close(): void;
}

/**
 * 실행(run) 이벤트를 invoke(startFlow)보다 "먼저" 구독한다.
 * startFlow는 백엔드에서 실행을 async로 띄우고 runId를 즉시 돌려주는데, 리스너를 그
 * 반환 뒤에 붙이면 그 틈에 나간 done 이벤트를 놓쳐 UI가 "지우는 중"에서 멈춘다.
 * 그래서 listen을 먼저 살려 두고(runId를 모르는 동안은 버퍼링), attach(runId) 때
 * 버퍼를 흘리고 이후엔 runId로 거른다. 이벤트가 runId를 실어 오므로 동시 실행도 안전하다.
 */
async function subscribeRun<T extends { runId: string }>(
  channel: string,
  cb: (payload: T) => void,
): Promise<RunSubscription> {
  let runId: string | null = null;
  let buffer: T[] = [];
  const unlisten = await listen<T>(channel, (e) => {
    const p = e.payload;
    if (runId === null) buffer.push(p);
    else if (p.runId === runId) cb(p);
  });
  return {
    attach(id: string) {
      runId = id;
      const pending = buffer;
      buffer = [];
      for (const p of pending) if (p.runId === id) cb(p);
    },
    close: unlisten,
  };
}

export const subscribeProgress = (cb: (ev: ProgressEvent) => void): Promise<RunSubscription> =>
  subscribeRun<ProgressEvent>("install://progress", cb);

export const subscribeLog = (cb: (line: string) => void): Promise<RunSubscription> =>
  subscribeRun<{ runId: string; line: string }>("install://log", (p) => cb(p.line));

export function onPtyData(sessionId: string, cb: (data: string) => void): Promise<UnlistenFn> {
  return listen<{ sessionId: string; data: string }>("pty://data", (e) => {
    if (e.payload.sessionId === sessionId) cb(e.payload.data);
  });
}
