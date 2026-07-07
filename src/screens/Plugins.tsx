import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ToolCard } from "../components/ToolCard";
import { listCatalog } from "../lib/ipc";
import { useTauriEvent } from "../lib/useTauriEvent";
import type { CatalogEntry } from "../lib/types";

export function Plugins() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setFailed(false);
    listCatalog().then(setEntries).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  useTauriEvent("catalog://updated", load);

  const plugins = entries.filter((e) => e.kind === "plugin");
  const nameOf = useCallback(
    (id: string) => entries.find((c) => c.id === id)?.name ?? id,
    [entries],
  );

  return (
    <div>
      <h1 className="text-title font-extrabold">플러그인 · 오픈소스</h1>
      <p className="mt-1 text-txt-secondary dark:text-txt-secondary-dark">
        쓰던 AI 도구를 더 똑똑하게 만들어 주는 부품이에요. 필요한 것까지 알아서 챙겨 드려요.
      </p>
      {failed ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="font-bold">목록을 가져오지 못했어요</p>
          <button
            type="button"
            className="rounded-badge border border-line dark:border-line-dark px-4 py-2 font-bold hover:bg-surface-card-hover dark:hover:bg-surface-card-hover-dark"
            onClick={load}
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plugins.map((e) => (
            <ToolCard key={e.id} entry={e} resolveName={nameOf} onSelect={(id) => navigate(`/wizard/${id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
