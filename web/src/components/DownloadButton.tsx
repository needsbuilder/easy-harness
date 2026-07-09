import { useState, type ReactNode } from "react";
import { RELEASES_LATEST_PAGE, type Asset, type Picks } from "../lib/releases";

/** 애플 공식 로고 (Bootstrap Icons, MIT) */
function AppleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="h-[1.15em] w-[1.15em]"
    >
      <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282" />
    </svg>
  );
}

/** 윈도우 공식 로고 (Bootstrap Icons, MIT) */
function WindowsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="h-[1.05em] w-[1.05em]"
    >
      <path d="M6.555 1.375 0 2.237v5.45h6.555zM0 13.795l6.555.933V8.313H0zm7.278-5.4.026 6.378L16 16V8.395zM16 0 7.33 1.244v6.414H16z" />
    </svg>
  );
}

function PrimaryLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="bg-gold-gradient inline-flex items-center justify-center gap-2.5 rounded-[12px] px-6 py-3 text-lg font-extrabold text-white shadow-[0_2px_10px_rgba(201,146,43,0.35)] transition hover:brightness-95"
    >
      {icon}
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

export function DownloadButton({ picks, failed }: { picks: Picks; failed: boolean }) {
  const [open, setOpen] = useState(false);
  const hasAny = picks.macArm || picks.macIntel || picks.winExe || picks.winMsi;

  if (failed || !hasAny) {
    return <PrimaryLink href={RELEASES_LATEST_PAGE}>다운로드</PrimaryLink>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {picks.winExe && (
          <PrimaryLink href={picks.winExe.url} icon={<WindowsIcon />}>
            윈도우용 다운로드
          </PrimaryLink>
        )}
        {picks.macArm && (
          <PrimaryLink href={picks.macArm.url} icon={<AppleIcon />}>
            맥용 다운로드
          </PrimaryLink>
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
