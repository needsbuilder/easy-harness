import { type ReactNode } from "react";
import { RELEASES_LATEST_PAGE, type Picks } from "../lib/releases";
import { AppleIcon, WindowsIcon } from "./icons";

function GoldLink({ href, icon, children }: { href: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <a
      href={href}
      className="bg-gold-gradient inline-flex items-center justify-center gap-2.5 rounded-[13px] px-6 py-[15px] text-[1.02rem] font-extrabold text-white shadow-[0_12px_30px_rgba(201,146,43,0.30)] transition hover:-translate-y-0.5 hover:brightness-[0.98]"
    >
      {icon}
      {children}
    </a>
  );
}

function OutlineLink({
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
      className="inline-flex items-center justify-center gap-2.5 rounded-[13px] border-[1.6px] border-line bg-surface-card px-6 py-[15px] text-[1.02rem] font-extrabold text-txt-primary transition hover:-translate-y-0.5 hover:border-brand hover:bg-surface-gold-tint"
    >
      {icon}
      {children}
    </a>
  );
}

export function DownloadButton({ picks, failed }: { picks: Picks; failed: boolean }) {
  const hasAny = picks.macArm || picks.macIntel || picks.winExe || picks.winMsi;

  if (failed || !hasAny) {
    return <GoldLink href={RELEASES_LATEST_PAGE}>다운로드</GoldLink>;
  }

  return (
    <>
      {picks.winExe && (
        <GoldLink href={picks.winExe.url} icon={<WindowsIcon />}>
          윈도우용 다운로드
        </GoldLink>
      )}
      {picks.macArm && (
        <OutlineLink href={picks.macArm.url} icon={<AppleIcon />}>
          맥용 다운로드
        </OutlineLink>
      )}
    </>
  );
}
