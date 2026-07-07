import { useState, type ReactNode } from "react";
import { RELEASES_LATEST_PAGE, type Asset, type OS, type Picks } from "../lib/releases";

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="bg-gold-gradient inline-flex items-center justify-center rounded-[12px] px-6 py-3 text-lg font-extrabold text-white shadow-[0_2px_10px_rgba(201,146,43,0.35)] transition hover:brightness-95"
    >
      {children}
    </a>
  );
}

function AssetRow({ label, asset }: { label: string; asset?: Asset }) {
  if (!asset) return null;
  return (
    <a
      href={asset.url}
      className="flex items-center justify-between gap-4 rounded-[12px] border border-line px-4 py-2 text-sm transition hover:bg-surface-gold-tint"
    >
      <span className="font-bold">{label}</span>
      <span className="truncate font-mono text-txt-tertiary">{asset.name}</span>
    </a>
  );
}

export function DownloadButton({ os, picks, failed }: { os: OS; picks: Picks; failed: boolean }) {
  const [open, setOpen] = useState(false);
  const hasAny = picks.macArm || picks.macIntel || picks.winExe || picks.winMsi;

  if (failed || !hasAny) {
    return <PrimaryLink href={RELEASES_LATEST_PAGE}>다운로드</PrimaryLink>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {os === "mac" && picks.macArm && (
          <PrimaryLink href={picks.macArm.url}>맥용 다운로드</PrimaryLink>
        )}
        {os === "windows" && picks.winExe && (
          <PrimaryLink href={picks.winExe.url}>윈도우용 다운로드</PrimaryLink>
        )}
        {os === "other" && (
          <>
            {picks.macArm && <PrimaryLink href={picks.macArm.url}>맥용 다운로드</PrimaryLink>}
            {picks.winExe && <PrimaryLink href={picks.winExe.url}>윈도우용 다운로드</PrimaryLink>}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-txt-secondary underline-offset-4 hover:underline"
      >
        다른 버전 보기
      </button>
      {open && (
        <div className="flex w-full max-w-md flex-col gap-2">
          <AssetRow label="맥 (애플 실리콘)" asset={picks.macArm} />
          <AssetRow label="맥 (인텔)" asset={picks.macIntel} />
          <AssetRow label="윈도우 (설치본)" asset={picks.winExe} />
          <AssetRow label="윈도우 (MSI)" asset={picks.winMsi} />
        </div>
      )}
    </div>
  );
}
