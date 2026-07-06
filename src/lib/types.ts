export type Platform = "mac" | "windows";
export type ToolKind = "harness" | "plugin" | "prerequisite";
export type FlowKind = "install" | "update" | "uninstall";

export interface Pricing { label: string; kind: "free" | "paid" | "freemium" }
export interface ModelBadge { modelLabel: string; accountLabel?: string | null }
export interface SourceInfo { label: string; url?: string | null }

export interface CatalogEntry {
  id: string; name: string; kind: ToolKind; easyDescription: string;
  pricing: Pricing; supportedModels: ModelBadge[]; recommended: boolean;
  requires: string[]; installed: boolean; installedVersion: string | null;
  missingRequires: string[]; source?: SourceInfo | null;
  platforms: Platform[]; available: boolean;
}

export interface EnvCheck { id: string; label: string; found: boolean; version: string | null }
export interface EnvReport {
  os: string; osLabel: string; arch: string; checks: EnvCheck[]; missingCount: number;
}

export interface DryRunStep {
  recipeId: string; recipeName: string; section: string; stepType: string; friendly: string;
}
export interface DryRunAuth {
  pattern: "browser_login" | "api_key" | "interactive_terminal" | "automatic";
  guide: string[];
}
export interface DryRunReport {
  targetId: string; platform: string; toolOrder: string[]; steps: DryRunStep[];
  auth: DryRunAuth | null;
}

export type StepStatus =
  | { kind: "running" }
  | { kind: "succeeded" }
  | { kind: "failed"; message: string }
  | { kind: "waitingSecret"; label: string }
  | { kind: "terminal"; sessionId: string }
  | { kind: "done"; success: boolean };

export interface ProgressEvent {
  runId: string; recipeId: string; recipeName: string; section: string;
  stepIndex: number; totalSteps: number; friendly: string; status: StepStatus;
}

export interface Installation {
  recipeId: string; version: string | null; installedAt: number;
  authDone: boolean; verifiedAt: number | null;
}
export interface AppState { installations: Installation[] }
