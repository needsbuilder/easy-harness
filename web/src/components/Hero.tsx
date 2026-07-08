import { type OS, type Picks } from "../lib/releases";
import { DownloadButton } from "./DownloadButton";

export function Hero({
  os,
  picks,
  version,
  failed,
}: {
  os: OS;
  picks: Picks;
  version: string | null;
  failed: boolean;
}) {
  return (
    <section className="relative overflow-hidden">
      {/* 은은한 골드 방사형 배경 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(232,193,90,0.28), rgba(252,250,246,0) 70%)",
        }}
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 pb-14 text-center">
        <div className="flex items-center gap-2">
          <img src="/mascot.png" alt="" className="h-9 w-9 object-contain" />
          <span className="text-xl font-extrabold tracking-tight">이지 하네스</span>
        </div>
        <img
          src="/mascot.png"
          alt=""
          className="mt-10 h-44 w-44 object-contain drop-shadow-[0_10px_24px_rgba(42,32,24,0.18)]"
        />
        <h1 className="mt-8 text-4xl font-extrabold leading-[1.2] tracking-tight md:text-5xl">
          터미널 없이,
          <br />
          클릭 몇 번으로 AI 코딩 도구를 시작하세요
        </h1>
        <p className="mt-5 max-w-xl text-lg text-txt-secondary">
          복잡한 설치와 로그인은 오공이가 다 해드려요. 카드만 고르면 끝이에요.
        </p>
        <div className="mt-9">
          <DownloadButton os={os} picks={picks} failed={failed} />
        </div>
        <p className="mt-5 text-sm text-txt-secondary">
          무료로 쓸 수 있어요 · 애플 공증과 서명을 마친 안전한 앱이에요
          {version && (
            <>
              {" · "}
              <span className="font-mono">{version}</span>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
