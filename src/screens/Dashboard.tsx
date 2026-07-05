import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PrimaryButton } from "../components/Buttons";
import { getAppState, listCatalog, startFlow } from "../lib/ipc";
import type { AppState, CatalogEntry } from "../lib/types";

export function Dashboard() {
  const [state, setState] = useState<AppState | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const navigate = useNavigate();

  const reload = useCallback(() => {
    getAppState().then(setState).catch(() => setState({ installations: [] }));
    listCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(reload, [reload]);

  const nameOf = (id: string) => catalog.find((c) => c.id === id)?.name ?? id;

  const uninstall = async (id: string) => {
    if (!window.confirm(`${nameOf(id)}을(를) 지울까요? 설정과 기록도 함께 정리돼요.`)) return;
    await startFlow(id, "uninstall", true); // M2: 데모 모드
    setTimeout(reload, 500);
  };

  if (!state) return null;
  const items = state.installations;

  return (
    <div>
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
            설치한 도구는 {items.length}개예요. 오공이가 매일 새 버전이 있는지 확인해요.
          </p>
          <ul className="mt-6 divide-y divide-line dark:divide-line-dark rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark shadow-card">
            {items.map((i) => (
              <li key={i.recipeId} className="flex items-center gap-4 px-5 py-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-surface-gold-tint font-extrabold text-txt-gold">
                  {nameOf(i.recipeId).charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{nameOf(i.recipeId)}</p>
                  <p className="font-mono text-caption text-txt-tertiary">v{i.version ?? "?"}</p>
                </div>
                <span className="text-caption font-semibold text-status-success">최신 상태예요</span>
                <button
                  type="button"
                  className="text-caption text-txt-tertiary hover:text-status-error"
                  onClick={() => uninstall(i.recipeId)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
