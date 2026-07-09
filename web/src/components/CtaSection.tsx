import { type Picks } from "../lib/releases";
import { DownloadButton } from "./DownloadButton";

export function CtaSection({ picks, failed }: { picks: Picks; failed: boolean }) {
  return (
    <section className="mx-auto max-w-[1120px] px-6 py-20">
      <div className="relative grid items-center gap-6 overflow-hidden rounded-[26px] border border-surface-gold-tint bg-gradient-to-br from-[#fbf3df] to-[#f8efdb] px-7 py-10 text-center md:grid-cols-[1fr_auto] md:px-12 md:py-13 md:text-left">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-[120px] -right-10 h-[360px] w-[360px]"
          style={{
            background: "radial-gradient(circle, rgba(232,193,90,0.4), transparent 65%)",
          }}
        />
        <div className="relative">
          <span className="font-mono text-[0.76rem] font-semibold tracking-[0.2em] text-txt-gold uppercase">
            무료로 시작
          </span>
          <h2 className="mt-2 text-[clamp(1.6rem,2.8vw,2.2rem)] font-extrabold tracking-[-0.03em] break-keep">
            지금 바로 시작해 보세요
          </h2>
          <p className="mt-2.5 break-keep text-txt-secondary">
            애플 공증과 서명을 마친 안전한 앱이에요.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            <DownloadButton picks={picks} failed={failed} />
          </div>
        </div>
        <img
          src="/mascot.png"
          alt=""
          className="motion-safe:animate-float relative mx-auto w-44 shrink-0 drop-shadow-[0_16px_22px_rgba(42,32,24,0.18)]"
        />
      </div>
    </section>
  );
}
