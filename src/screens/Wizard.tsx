import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AuthGuidePanel } from "../components/AuthGuidePanel";
import { PrimaryButton } from "../components/Buttons";
import { LogPanel } from "../components/LogPanel";
import { ErrorPanel } from "../components/ErrorPanel";
import { MascotBubble } from "../components/MascotBubble";
import { SecretForm } from "../components/SecretForm";
import { TerminalPanel } from "../components/TerminalPanel";
import { WizardStepper } from "../components/WizardStepper";
import { getDryRun, onLog, onProgress, provideSecret, startFlow } from "../lib/ipc";
import { eunNeun } from "../lib/josa";
import { appendLog, initialRunState, runReducer, type RunState } from "../lib/runReducer";
import type { DryRunReport } from "../lib/types";

export function Wizard() {
  const { toolId = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<RunState>(() => initialRunState(toolId));
  const [preview, setPreview] = useState<DryRunReport | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [secretSubmitting, setSecretSubmitting] = useState(false);

  const tools = preview?.tools ?? [];
  const target = tools.find((t) => t.id === toolId);
  const toolName = target?.name ?? toolId;
  const helpers = tools.filter((t) => t.id !== toolId);
  const pendingHarnesses = helpers.filter((t) => t.kind === "harness");
  const needsPreflight = pendingHarnesses.length > 0;
  const currentAuth = tools.find((t) => t.id === state.currentRecipeId)?.auth ?? null;
  const helperNames = helpers.map((t) => t.name);

  // 1) 미리보기: 도구·재시도 단위로 새로 읽는다 (읽기 전용이라 중복 호출 무해)
  useEffect(() => {
    let cancelled = false;
    setState(initialRunState(toolId));
    setPreview(null);
    setConfirmed(false);
    getDryRun(toolId)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, error: { message: "시작하지 못했어요. 다시 시도해 볼까요?", friendly: "준비 단계" } }));
      });
    return () => { cancelled = true; };
  }, [toolId, attempt]);

  // 2) 시작: 미리보기가 준비되고, 선행 안내가 없거나 사용자가 눌렀을 때 1회만.
  //    StrictMode 이중 마운트에서도 같은 key면 시작 promise를 재사용한다.
  const shouldStart = preview !== null && (!needsPreflight || confirmed);
  const startRef = useRef<{ key: string; promise: Promise<string> } | null>(null);
  useEffect(() => {
    if (!shouldStart) return;
    let cancelled = false;
    let unProgress: (() => void) | undefined;
    let unLog: (() => void) | undefined;
    const key = `${toolId}:${attempt}`;
    if (!startRef.current || startRef.current.key !== key) {
      startRef.current = { key, promise: startFlow(toolId, "install", false) };
    }
    (async () => {
      try {
        const newRunId = await startRef.current!.promise;
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
    return () => { cancelled = true; unProgress?.(); unLog?.(); };
  }, [shouldStart, toolId, attempt]);

  useEffect(() => {
    if (state.done && state.success) {
      navigate(`/success/${toolId}`, { state: { name: toolName, helpers: helperNames } });
    }
  }, [state.done, state.success, navigate, toolId, toolName, helperNames]);

  // waitingSecret이 바뀌면(해소되거나 재시도로 리셋되면) 제출 잠금을 푼다.
  useEffect(() => {
    setSecretSubmitting(false);
  }, [state.waitingSecret]);

  const preflight = preview !== null && needsPreflight && !confirmed && !state.error;

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
        ) : preflight ? (
          <>
            <h1 className="text-display font-extrabold">먼저 챙길 게 있어요</h1>
            <p className="mt-4 text-txt-secondary dark:text-txt-secondary-dark">
              {toolName}{eunNeun(toolName)} {pendingHarnesses.map((t) => t.name).join("·")} 위에서 도는 도구예요.
              아래 순서대로 한 번에 진행할게요.
            </p>
            <ol className="mx-auto mt-6 flex w-fit flex-col gap-2 text-left font-bold">
              {pendingHarnesses.map((t, i) => (
                <li key={t.id}>{i + 1}. {t.name} 설치하고 로그인하기</li>
              ))}
              <li>{pendingHarnesses.length + 1}. {toolName} 설치하기</li>
            </ol>
            {helpers.some((t) => t.kind === "prerequisite") && (
              <p className="mt-3 text-caption text-txt-tertiary">필요한 준비물도 함께 챙겨요.</p>
            )}
            <PrimaryButton className="mt-8" onClick={() => setConfirmed(true)}>
              좋아요, 시작할게요
            </PrimaryButton>
          </>
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
              submitting={secretSubmitting}
              onSubmit={(value) => {
                setSecretSubmitting(true);
                runId && provideSecret(runId, state.waitingSecret as string, value);
              }}
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
