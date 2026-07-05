import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { LogPanel } from "../components/LogPanel";
import { ErrorPanel } from "../components/ErrorPanel";
import { MascotBubble } from "../components/MascotBubble";
import { WizardStepper } from "../components/WizardStepper";
import { getDryRun, onLog, onProgress, startFlow } from "../lib/ipc";
import { appendLog, initialRunState, runReducer, type RunState } from "../lib/runReducer";

export function Wizard() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<RunState>(() => initialRunState(toolId));
  const [toolName, setToolName] = useState(toolId);
  const [showLog, setShowLog] = useState(false);
  const started = useRef(false);

  const start = useCallback(async () => {
    setState(initialRunState(toolId));
    const preview = await getDryRun(toolId);
    const target = preview.steps.find((s) => s.recipeId === toolId);
    if (target) setToolName(target.recipeName);
    const runId = await startFlow(toolId, "install", true); // M2: 드라이런 데모 고정
    const unProgress = await onProgress(runId, (ev) => setState((s) => runReducer(s, ev)));
    const unLog = await onLog(runId, (line) => setState((s) => appendLog(s, line)));
    return () => { unProgress(); unLog(); };
  }, [toolId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const cleanup = start();
    return () => { cleanup.then((fn) => fn?.()); };
  }, [start]);

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
            onRetry={() => { started.current = false; setState(initialRunState(toolId)); start(); }}
            onCopyLog={() => navigator.clipboard.writeText(state.logs.join("\n"))}
          />
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
            <div className="mt-10 flex justify-center">
              <MascotBubble text="제가 근두운 타고 후딱 받아오는 중이에요. 커피 한 잔 하고 오세요!" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
