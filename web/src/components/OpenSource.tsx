import { GITHUB_NEW_TOOL_ISSUE, GITHUB_REPO } from "../lib/links";
import { formatStars, useGithubStars } from "../lib/useGithubStars";
import { GithubIcon, StarIcon } from "./icons";

export function OpenSource() {
  const stars = useGithubStars();

  return (
    <section className="mx-auto max-w-[1120px] px-6 py-16">
      <div className="rounded-[26px] border border-line bg-surface-card px-7 py-10 md:px-12 md:py-12">
        <div className="grid items-center gap-9 md:grid-cols-[1.15fr_auto]">
          <div>
            <span className="inline-flex items-center gap-[7px] rounded-full bg-surface-gold-tint px-[13px] py-[6px] font-mono text-[0.72rem] font-semibold tracking-[0.12em] text-txt-gold uppercase">
              <GithubIcon className="h-[13px] w-[13px]" />
              Apache 2.0 오픈소스
            </span>
            <h2 className="mt-4 text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold tracking-[-0.03em] break-keep">
              코드를 전부 공개했어요
            </h2>
            <p className="mt-3 max-w-[46ch] break-keep leading-[1.75] text-txt-secondary">
              내 컴퓨터에서 무엇을 하는 앱인지 한 줄까지 열어뒀어요. 별을 눌러주시면 더 많은
              분들에게 닿습니다.
            </p>
            <p className="mt-2 max-w-[46ch] break-keep leading-[1.75] text-txt-secondary">
              도구를 만드셨다면 직접 올리실 수도 있어요. JSON 파일 하나면 됩니다.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-[9px] rounded-full bg-brand px-[22px] py-[13px] text-[0.95rem] font-bold text-white shadow-[0_10px_20px_rgba(190,150,60,0.28)] transition hover:brightness-[1.06]"
              >
                <StarIcon />
                GitHub에서 별 주기
                {stars !== null && (
                  <span className="ml-[2px] rounded-full bg-white/22 px-[9px] py-[2px] font-mono text-[0.82rem]">
                    {formatStars(stars)}
                  </span>
                )}
              </a>
              <a
                href={GITHUB_NEW_TOOL_ISSUE}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-[7px] rounded-full border-[1.5px] border-line px-[20px] py-[13px] text-[0.95rem] font-bold text-txt-secondary transition hover:border-brand hover:bg-surface-gold-tint hover:text-txt-primary"
              >
                내 도구 추가하기
              </a>
            </div>
          </div>

          <img
            src="/mascot.png"
            alt=""
            className="motion-safe:animate-float mx-auto w-36 shrink-0 drop-shadow-[0_16px_22px_rgba(42,32,24,0.16)] md:w-44"
          />
        </div>
      </div>
    </section>
  );
}
