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

export function onProgress(runId: string, cb: (ev: ProgressEvent) => void): Promise<UnlistenFn> {
  return listen<ProgressEvent>("install://progress", (e) => {
    if (e.payload.runId === runId) cb(e.payload);
  });
}

export function onLog(runId: string, cb: (line: string) => void): Promise<UnlistenFn> {
  return listen<{ runId: string; line: string }>("install://log", (e) => {
    if (e.payload.runId === runId) cb(e.payload.line);
  });
}
