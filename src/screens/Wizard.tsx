import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AuthGuidePanel } from "../components/AuthGuidePanel";
import { LogPanel } from "../components/LogPanel";
import { ErrorPanel } from "../components/ErrorPanel";
import { MascotBubble } from "../components/MascotBubble";
import { SecretForm } from "../components/SecretForm";
import { TerminalPanel } from "../components/TerminalPanel";
import { WizardStepper } from "../components/WizardStepper";
import { getDryRun, onLog, onProgress, provideSecret, startFlow } from "../lib/ipc";
import { appendLog, initialRunState, runReducer, type RunState } from "../lib/runReducer";
import type { DryRunAuth, DryRunTool } from "../lib/types";

export function Wizard() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<RunState>(() => initialRunState(toolId));
  const [toolName, setToolName] = useState(toolId);
  const [showLog, setShowLog] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tools, setTools] = useState<DryRunTool[]>([]);
  const [runId, setRunId] = useState<string | null>(null);

  // 시작 가드: StrictMode(dev)의 mount→cleanup→mount 이중 호출에서도 같은 컴포넌트
  // 인스턴스이므로 ref는 유지된다. 같은 key(toolId:attempt)면 이미 만든 시작 promise를
  // 재사용해 실제 설치(startFlow)가 두 번 시작되지 않는다. 재시도(attempt)나 도구
  // 변경은 key가 달라져 새로 시작한다. 구독(onProgress/onLog)은 이펙트 인스턴스마다
  // 다시 붙고, cancelled 가드로 실제로 살아남는 인스턴스만 구독을 유지한다.
  const startRef = useRef<{ key: string; promise: Promise<{ runId: string; tools: DryRunTool[]; toolName: string }> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unProgress: (() => void) | undefined;
    let unLog: (() => void) | undefined;

    setState(initialRunState(toolId));
    const key = `${toolId}:${attempt}`;
    if (!startRef.current || startRef.current.key !== key) {
      startRef.current = {
        key,
        promise: (async () => {
          const preview = await getDryRun(toolId);
          const target = preview.steps.find((s) => s.recipeId === toolId);
          const newRunId = await startFlow(toolId, "install", false);
          return { runId: newRunId, tools: preview.tools, toolName: target?.recipeName ?? toolId };
        })(),
      };
    }
    (async () => {
      try {
        const { runId: newRunId, tools: newTools, toolName: newToolName } = await startRef.current!.promise;
        if (cancelled) return;
        setToolName(newToolName);
        setTools(newTools);
        setRunId(newRunId);
        const p = await onProgress(newRunId, (ev) => setState((s) => runReducer(s, ev)));
        if (cancelled) { p(); return; }
        unProgress = p;
        const l = await onLog(newRunId, (line) => setState((s) => appendLog(s, line)));
        if (cancelled) { l(); return; }
        unLog = l;
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, error: { message: "시작하지 못했어요. 다시 시도해 볼까요?", friendly: "준비 단계" } }));
        }
      }
    })();

    return () => {
      cancelled = true;
      unProgress?.();
      unLog?.();
    };
  }, [toolId, attempt]);

  useEffect(() => {
    if (state.done && state.success) navigate(`/success/${toolId}`, { state: { name: toolName } });
  }, [state.done, state.success, navigate, toolId, toolName]);

  const currentAuth: DryRunAuth | null = tools.find((t) => t.id === state.currentRecipeId)?.auth ?? null;
  const helperNames = tools.filter((t) => t.id !== toolId).map((t) => t.name);

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface-bg dark:bg-surface-bg-dark px-8 py-12">
      <WizardStepper current={state.phase} toolName={toolName} helperNames={helperNames} />
      <div className={`mt-12 w-full ${state.terminalSession ? "max-w-5xl" : "max-w-2xl"} text-center`}>
        {state.error ? (
          <ErrorPanel
            message={state.error.message}
            friendly={state.error.friendly}
            onRetry={() => setAttempt((n) => n + 1)}
            onCopyLog={() => navigator.clipboard.writeText(state.logs.join("\n"))}
          />
        ) : state.terminalSession ? (
          <>
            <h1 className="text-display font-extrabold">아래 까만 창에서 로그인을 도와드릴게요</h1>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
              <TerminalPanel sessionId={state.terminalSession} />
              <AuthGuidePanel guide={currentAuth?.guide ?? []} stacked />
            </div>
          </>
        ) : state.waitingSecret ? (
          <>
            <h1 className="text-display font-extrabold">열쇠 하나만 등록하면 돼요</h1>
            <AuthGuidePanel guide={currentAuth?.guide ?? []} />
            <SecretForm
              label={state.waitingSecret}
              onSubmit={(value) => runId && provideSecret(runId, state.waitingSecret as string, value)}
            />
          </>
        ) : (
          <>
            <h1 className="text-display font-extrabold">
              {state.friendly} <span className="text-txt-gold">({Math.min(state.phase, 4)}/4단계)</span>
            </h1>
            <div className="mt-8 h-2 w-full overflow-hidden rounded-badge bg-line dark:bg-line-dark">
              <div className="bg-gold-gradient h-full transition-all" style={{ width: `${state.percent}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-caption text-txt-tertiary">
              <span>{state.stepIndex}/{state.totalSteps || "?"} 단계</span>
              <button type="button" className="hover:text-txt-secondary" onClick={() => setShowLog((v) => !v)}>
                자세한 과정 보기
              </button>
            </div>
            <LogPanel lines={state.logs} visible={showLog} />
            {state.section === "auth" && <AuthGuidePanel guide={currentAuth?.guide ?? []} />}
            <div className="mt-10 flex justify-center">
              <MascotBubble text="제가 근두운 타고 후딱 받아오는 중이에요. 커피 한 잔 하고 오세요!" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
