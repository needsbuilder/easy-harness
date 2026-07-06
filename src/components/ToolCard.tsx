import { Badge } from "./Badge";
import type { CatalogEntry } from "../lib/types";

export function ToolCard({ entry, onSelect, resolveName }: {
  entry: CatalogEntry;
  onSelect: (id: string) => void;
  resolveName?: (id: string) => string;
}) {
  const unavailable = !entry.available;
  return (
    <button
      type="button"
      onClick={() => { if (!unavailable) onSelect(entry.id); }}
      aria-disabled={unavailable}
      className={`relative rounded-card bg-surface-card dark:bg-surface-card-dark shadow-card hover:shadow-card-hover hover:bg-surface-card-hover dark:hover:bg-surface-card-hover-dark border border-line dark:border-line-dark p-5 text-left transition-shadow${unavailable ? " opacity-60 cursor-not-allowed" : ""}`}
    >
      {entry.installed && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-gold-gradient text-txt-on-brand text-badge" aria-hidden>
          ✓
        </span>
      )}
      <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-surface-gold-tint text-title font-extrabold text-txt-gold">
        {entry.name.charAt(0)}
      </span>
      <h3 className="mt-3 text-subtitle font-bold">{entry.name}</h3>
      <p className="mt-1 text-body text-txt-secondary dark:text-txt-secondary-dark">{entry.easyDescription}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {entry.recommended && <Badge variant="recommended">입문자 추천</Badge>}
        {entry.supportedModels.map((m) => (
          <span key={m.modelLabel} className="contents">
            <Badge variant="model">{m.modelLabel}</Badge>
            {m.accountLabel && <Badge variant="account">{m.accountLabel}</Badge>}
          </span>
        ))}
        <Badge variant="pricing">{entry.pricing.label}</Badge>
        {entry.missingRequires.map((id) => (
          <Badge key={id} variant="warning">{(resolveName?.(id) ?? id)} 필요</Badge>
        ))}
        {unavailable && (
          <Badge variant="warning">
            {entry.platforms.length === 1 && entry.platforms[0] === "mac"
              ? "지금은 맥에서만 설치돼요"
              : "이 컴퓨터에서는 아직 설치할 수 없어요"}
          </Badge>
        )}
      </div>
      {entry.kind === "plugin" && entry.requires.length > 0 && (
        <p className="mt-2 text-caption text-txt-tertiary">
          {entry.requires.map((id) => resolveName?.(id) ?? id).join("·")}에 설치돼요
        </p>
      )}
      {entry.source && (
        <p className="mt-3 text-caption text-txt-tertiary">{entry.source.label}</p>
      )}
      {entry.installed && (
        <p className="mt-3 text-caption text-txt-tertiary font-mono">
          설치됨 · v{entry.installedVersion ?? "?"}
        </p>
      )}
    </button>
  );
}
