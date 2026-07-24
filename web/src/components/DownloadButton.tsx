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

  // 맥 버튼은 애플 실리콘용이 기본. 애플 실리콘 자산이 없으면 인텔용이 버튼 자리를 대신한다.
  const mac = picks.macArm ?? picks.macIntel;

  return (
    <>
      {picks.winExe && (
        <GoldLink href={picks.winExe.url} icon={<WindowsIcon />}>
          윈도우용 다운로드
        </GoldLink>
      )}
      {mac && (
        <OutlineLink href={mac.url} icon={<AppleIcon />}>
          맥용 다운로드
        </OutlineLink>
      )}
      {picks.macArm && picks.macIntel && (
        <p className="basis-full text-[0.88rem] break-keep text-txt-secondary">
          인텔 칩 맥이라면{" "}
          <a
            href={picks.macIntel.url}
            className="font-bold text-txt-gold underline underline-offset-2 transition hover:text-brand-hover"
          >
            인텔 맥용 설치 파일
          </a>
          을 받아주세요. 사과 메뉴의 &lsquo;이 Mac에 관하여&rsquo;에서 칩을 확인할 수 있어요.
        </p>
      )}
    </>
  );
}
