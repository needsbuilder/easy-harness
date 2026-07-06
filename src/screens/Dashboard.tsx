import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PrimaryButton } from "../components/Buttons";
import { getAppState, listCatalog, onProgress, startFlow } from "../lib/ipc";
import type { AppState, CatalogEntry } from "../lib/types";

const formatInstalledAt = (unixSeconds: number) =>
  `${new Date(unixSeconds * 1000).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}에 설치했어요`;

export function Dashboard() {
  const [state, setState] = useState<AppState | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // 앱 자체 업데이트 알림 자리. 마일스톤 5에서 tauri-plugin-updater 연동으로 채워진다
  const appUpdateReady = false;

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
      {appUpdateReady && (
        <div className="mb-6 flex items-center justify-between rounded-card border border-line-gold bg-surface-gold-tint px-5 py-4">
          <p className="font-bold">이지 하네스 새 버전이 나왔어요. 1분이면 끝나요.</p>
          <PrimaryButton>지금 업데이트</PrimaryButton>
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
                    <p className="font-mono text-caption text-txt-tertiary">v{i.version}</p>
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
