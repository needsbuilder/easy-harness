import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PrimaryButton } from "../components/Buttons";
import { useAppUpdate } from "../lib/appUpdate";
import { getAppState, listCatalog, onProgress, startFlow } from "../lib/ipc";
import type { AppState, CatalogEntry } from "../lib/types";

const formatInstalledAt = (unixSeconds: number) =>
  `${new Date(unixSeconds * 1000).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}에 설치했어요`;

export function Dashboard() {
  const [state, setState] = useState<AppState | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { phase: updatePhase, install: installUpdate } = useAppUpdate();

  const reload = useCallback(() => {
    getAppState().then(setState).catch(() => setState({ installations: [] }));
    listCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(reload, [reload]);

  const nameOf = (id: string) => catalog.find((c) => c.id === id)?.name ?? id;

  const uninstall = async (id: string) => {
    if (removing.has(id)) return;
    const dependents = catalog
      .filter((c) => c.installed && c.requires.includes(id))
      .map((c) => c.name);
    const warning = dependents.length > 0
      ? `이 도구를 지우면 위에 얹혀 있는 ${dependents.join("·")}도 함께 멈출 수 있어요. `
      : "";
    if (!window.confirm(`${warning}${nameOf(id)}을(를) 지울까요? 설정과 기록도 함께 정리돼요.`)) return;
    setRemoving((s) => new Set(s).add(id));
    try {
      const runId = await startFlow(id, "uninstall", false);
      const un = await onProgress(runId, (ev) => {
        if (ev.status.kind === "done") {
          un();
          reload();
          setRemoving((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        }
      });
    } catch {
      setRemoving((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  if (!state) return null;
  const items = state.installations;

  return (
    <div>
      {updatePhase.kind !== "idle" && (
        <div className="mb-6 flex items-center justify-between rounded-card border border-line-gold bg-surface-gold-tint px-5 py-4">
          {updatePhase.kind === "available" && (
            <>
              <p className="font-bold">이지 하네스 새 버전이 나왔어요. 1분이면 끝나요.</p>
              <PrimaryButton onClick={installUpdate}>지금 업데이트</PrimaryButton>
            </>
          )}
          {updatePhase.kind === "downloading" && (
            <p className="font-bold">새 버전을 받는 중이에요 {updatePhase.percent}%</p>
          )}
          {updatePhase.kind === "failed" && (
            <p className="font-bold">업데이트를 받지 못했어요. 다음에 다시 시도할게요.</p>
          )}
        </div>
      )}
      <h1 className="text-title font-extrabold">내 도구</h1>
      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4">
          <p className="text-txt-secondary dark:text-txt-secondary-dark">
            아직 설치한 도구가 없어요. 첫 도구를 골라 볼까요?
          </p>
          <PrimaryButton onClick={() => navigate("/catalog")}>도구 고르러 가기</PrimaryButton>
        </div>
      ) : (
        <>
          <p className="mt-1 text-txt-secondary dark:text-txt-secondary-dark">
            설치한 도구는 {items.length}개예요.
          </p>
          <ul className="mt-6 divide-y divide-line dark:divide-line-dark rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark shadow-card">
            {items.map((i) => (
              <li key={i.recipeId} className="flex items-center gap-4 px-5 py-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-surface-gold-tint font-extrabold text-txt-gold">
                  {nameOf(i.recipeId).charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{nameOf(i.recipeId)}</p>
                  {i.version ? (
                    <p className="text-caption text-txt-tertiary">
                      <span className="font-mono">v{i.version}</span> · {formatInstalledAt(i.installedAt)}
                    </p>
                  ) : (
                    <p className="text-caption text-txt-tertiary">{formatInstalledAt(i.installedAt)}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-caption text-txt-tertiary hover:text-status-error disabled:opacity-50"
                  disabled={removing.has(i.recipeId)}
                  onClick={() => uninstall(i.recipeId)}
                >
                  {removing.has(i.recipeId) ? "지우는 중" : "삭제"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
