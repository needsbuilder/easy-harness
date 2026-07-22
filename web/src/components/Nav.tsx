import { Link } from "react-router-dom";
import { GITHUB_REPO } from "../lib/links";
import { formatStars, useGithubStars } from "../lib/useGithubStars";
import { GithubIcon, StarIcon } from "./icons";

export function Nav() {
  const stars = useGithubStars();

  return (
    <header className="relative z-10">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-6 py-[22px]">
        <Link to="/" className="flex items-center gap-[11px]">
          <img src="/mascot.png" alt="" className="h-10 w-10 object-contain" />
          <span>
            <span className="block text-[1.15rem] font-extrabold leading-none tracking-tight">
              이지 하네스
            </span>
            <span className="mt-1 block font-mono text-[0.58rem] tracking-[0.34em] text-txt-gold">
              EASY HARNESS
            </span>
          </span>
        </Link>
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener"
          aria-label={
            stars === null
              ? "GitHub 저장소에서 별 주기"
              : `GitHub 저장소에서 별 주기, 지금 ${stars}개`
          }
          className="group inline-flex items-center gap-2 rounded-full border-[1.5px] border-line-gold bg-surface-gold-tint px-[17px] py-[9px] text-[0.92rem] font-bold text-txt-gold transition hover:border-brand hover:bg-brand hover:text-white"
        >
          <GithubIcon className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">GitHub 별 주기</span>
          <span className="sm:hidden">별 주기</span>
          <StarIcon className="h-[14px] w-[14px] transition group-hover:scale-110" />
          {stars !== null && (
            <span className="rounded-full bg-white/70 px-[8px] py-[1px] font-mono text-[0.8rem] transition group-hover:bg-white/25">
              {formatStars(stars)}
            </span>
          )}
        </a>
      </div>
    </header>
  );
}
