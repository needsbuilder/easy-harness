import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ToolCard } from "../components/ToolCard";
import { listCatalog } from "../lib/ipc";
import { useTauriEvent } from "../lib/useTauriEvent";
import type { CatalogEntry } from "../lib/types";

export function Catalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setFailed(false);
    listCatalog().then(setEntries).catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);
  useTauriEvent("catalog://updated", load);

  const harnesses = entries.filter((e) => e.kind === "harness");

  return (
    <div>
      <h1 className="text-title font-extrabold">어떤 AI 도구를 써볼까요?</h1>
      <p className="mt-1 text-txt-secondary dark:text-txt-secondary-dark">
        카드를 누르면 설치부터 로그인까지 오공이가 다 해줘요.
      </p>
      {failed ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="font-bold">도구 목록을 가져오지 못했어요</p>
          <button
            type="button"
            className="rounded-badge border border-line dark:border-line-dark px-4 py-2 font-bold hover:bg-surface-card-hover dark:hover:bg-surface-card-hover-dark"
            onClick={load}
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {harnesses.map((e) => (
            <ToolCard key={e.id} entry={e} onSelect={(id) => navigate(`/wizard/${id}`)} />
          ))}
        </div>
      )}
      <p className="mt-6 text-caption text-txt-tertiary">
        플러그인과 오픈소스는 왼쪽 메뉴에 따로 모아둬요.
      </p>
    </div>
  );
}
