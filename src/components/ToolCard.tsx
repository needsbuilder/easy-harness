import { toolIconFor } from "../lib/toolIcons";
import type { CatalogEntry } from "../lib/types";

export function ToolCard({ entry, onSelect, resolveName }: {
  entry: CatalogEntry;
  onSelect: (id: string) => void;
  resolveName?: (id: string) => string;
}) {
  const unavailable = !entry.available;
  const isPlugin = entry.kind === "plugin" && entry.requires.length > 0;
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
      <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[12px] bg-surface-gold-tint text-title font-extrabold text-txt-gold">
        {toolIconFor(entry.id) ? (
          <img src={toolIconFor(entry.id)} alt="" className="h-full w-full object-cover" />
        ) : (
          entry.name.charAt(0)
        )}
      </span>
      <h3 className="mt-3 text-subtitle font-bold">{entry.name}</h3>
      <p className="mt-1 line-clamp-2 text-body text-txt-secondary dark:text-txt-secondary-dark">
        {entry.easyDescription}
      </p>
      {isPlugin && (
        <p className="mt-2 text-caption text-txt-tertiary">
          {entry.requires.map((id) => resolveName?.(id) ?? id).join("·")}에 설치돼요
        </p>
      )}
    </button>
  );
}
