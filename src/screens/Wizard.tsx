import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AuthGuidePanel } from "../components/AuthGuidePanel";
import { LogPanel } from "../components/LogPanel";
import { ErrorPanel } from "../components/ErrorPanel";
import { MascotBubble } from "../components/MascotBubble";
import { SecretForm } from "../components/SecretForm";
import { WizardStepper } from "../components/WizardStepper";
import { getDryRun, onLog, onProgress, provideSecret, startFlow } from "../lib/ipc";
import { appendLog, initialRunState, runReducer, type RunState } from "../lib/runReducer";
import type { DryRunAuth } from "../lib/types";

export function Wizard() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<RunState>(() => initialRunState(toolId));
  const [toolName, setToolName] = useState(toolId);
  const [showLog, setShowLog] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [auth, setAuth] = useState<DryRunAuth | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  // 취소 패턴: StrictMode(dev)의 mount→cleanup→mount 이중 호출에서 1차 mount는
  // cancelled=true를 만난 시점 이후로는 리스너 없이 흘러가고(등록된 구독은 즉시 정리),
  // 2차(실제) mount만 살아있는 구독을 유지한다. 데모 런(start_flow)이 백엔드에서
  // 2번 시작될 가능성이 있지만 무해하며, UI는 runId 필터 덕분에 2차 런만 추적한다.
  useEffect(() => {
    let cancelled = false;
    let unProgress: (() => void) | undefined;
    let unLog: (() => void) | undefined;

    setState(initialRunState(toolId));
    setAuth(null);
    setRunId(null);
    (async () => {
      try {
        const preview = await getDryRun(toolId);
        if (cancelled) return;
        const target = preview.steps.find((s) => s.recipeId === toolId);
        if (target) setToolName(target.recipeName);
        setAuth(preview.auth);
        const newRunId = await startFlow(toolId, "install", true); // M2: 드라이런 데모 고정
        if (cancelled) return;
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
    if (state.done && state.success) navigate(`/success/${toolId}`);
  }, [state.done, state.success, navigate, toolId]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface-bg dark:bg-surface-bg-dark px-8 py-12">
      <WizardStepper current={state.phase} toolName={toolName} />
      <div className="mt-12 w-full max-w-2xl text-center">
        {state.error ? (
          <ErrorPanel
            message={state.error.message}
            friendly={state.error.friendly}
            onRetry={() => setAttempt((n) => n + 1)}
            onCopyLog={() => navigator.clipboard.writeText(state.logs.join("\n"))}
          />
        ) : state.waitingSecret ? (
          <>
            <h1 className="text-display font-extrabold">열쇠 하나만 등록하면 돼요</h1>
            <AuthGuidePanel guide={auth?.guide ?? []} />
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
            {state.section === "auth" && <AuthGuidePanel guide={auth?.guide ?? []} />}
            <div className="mt-10 flex justify-center">
              <MascotBubble text="제가 근두운 타고 후딱 받아오는 중이에요. 커피 한 잔 하고 오세요!" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
