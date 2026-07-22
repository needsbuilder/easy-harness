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
              ? "GitHub 저장소 열기"
              : `GitHub 저장소 열기, 별 ${stars}개를 받았어요`
          }
          className="group inline-flex items-center gap-[7px] rounded-full border-[1.5px] border-line px-[15px] py-2 text-[0.88rem] font-bold text-txt-secondary transition hover:border-brand hover:bg-surface-gold-tint hover:text-txt-primary"
        >
          <GithubIcon />
          GitHub
          {stars !== null && (
            <span className="ml-[3px] inline-flex items-center gap-[3px] border-l border-line pl-[9px] font-mono text-[0.8rem] text-txt-gold transition group-hover:text-txt-primary">
              <StarIcon className="h-[13px] w-[13px]" />
              {formatStars(stars)}
            </span>
          )}
        </a>
      </div>
    </header>
  );
}
