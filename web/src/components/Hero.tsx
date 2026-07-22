import { type Picks } from "../lib/releases";
import { GITHUB_REPO } from "../lib/links";
import { formatStars, useGithubStars } from "../lib/useGithubStars";
import { DownloadButton } from "./DownloadButton";
import { GithubIcon, StarIcon } from "./icons";

export function Hero({ picks, failed }: { picks: Picks; failed: boolean }) {
  const stars = useGithubStars();

  return (
    <section className="relative">
      {/* 골드 방사형 배경 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-[200px] -right-[140px] h-[760px] w-[760px]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(232,193,90,0.32), rgba(232,193,90,0) 62%)",
          }}
        />
      </div>
      <div className="relative mx-auto grid max-w-[1120px] items-center gap-10 px-6 pt-9 pb-[76px] md:grid-cols-[1.05fr_0.95fr]">
        <div className="text-center md:text-left">
          <span className="font-mono text-[0.76rem] font-semibold tracking-[0.2em] text-txt-gold uppercase">
            설치 · 로그인 · 확인까지 한 번에
          </span>
          <h1 className="mt-[18px] text-[clamp(2.3rem,4.4vw,3.5rem)] leading-[1.16] font-extrabold tracking-[-0.035em] break-keep">
            터미널 없이,
            <br />
            클릭 몇 번으로{" "}
            <span className="relative whitespace-nowrap text-brand-hover">
              <span className="relative z-10">AI 코딩 도구</span>
              <span
                aria-hidden
                className="absolute -inset-x-0.5 bottom-[0.08em] h-[0.3em] rounded"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(232,193,90,0.55), rgba(201,146,43,0.28))",
                }}
              />
            </span>
            를
            <br />
            시작하세요
          </h1>
          <p className="mx-auto mt-5 max-w-[32ch] text-lg break-keep text-txt-secondary md:mx-0">
            복잡한 설치와 로그인은 오공이가 다 해드려요. 카드만 고르면 끝이에요.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            <DownloadButton picks={picks} failed={failed} />
          </div>
          {/* 다운로드가 주 CTA 라 버튼은 아니지만, 눈에 걸리도록 알약 배경을 준다 */}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener"
            className="group mt-5 inline-flex items-center gap-[10px] rounded-full border border-line-gold bg-surface-card px-[16px] py-[10px] text-[0.95rem] shadow-[0_2px_10px_rgba(42,32,24,0.05)] transition hover:border-brand hover:bg-surface-gold-tint"
          >
            <GithubIcon className="h-[17px] w-[17px] text-txt-secondary transition group-hover:text-txt-primary" />
            <span className="break-keep text-txt-secondary transition group-hover:text-txt-primary">
              오픈소스예요. 마음에 들면{" "}
              <span className="font-extrabold text-txt-gold">GitHub에 별 하나</span> 눌러주세요
            </span>
            <span className="inline-flex items-center gap-[3px] rounded-full bg-surface-gold-tint px-[9px] py-[3px] font-mono text-[0.8rem] font-bold text-txt-gold transition group-hover:bg-brand group-hover:text-white">
              <StarIcon className="h-[12px] w-[12px]" />
              {stars !== null ? formatStars(stars) : "Star"}
            </span>
          </a>
        </div>
        <div className="relative order-first flex min-h-[300px] items-center justify-center md:order-last md:min-h-[380px]">
          <span
            aria-hidden
            className="absolute aspect-square w-[82%] rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(232,193,90,0.34), rgba(232,193,90,0) 68%)",
            }}
          />
          <span
            aria-hidden
            className="motion-safe:animate-float absolute aspect-square w-[72%] rounded-full border-[1.5px] border-dashed border-[rgba(216,172,59,0.45)]"
          />
          <img
            src="/mascot.png"
            alt="근두운을 탄 오공이"
            className="motion-safe:animate-float relative w-[min(320px,72%)] drop-shadow-[0_24px_32px_rgba(42,32,24,0.2)] md:w-[min(430px,88%)]"
          />
        </div>
      </div>
    </section>
  );
}
