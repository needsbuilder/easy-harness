import { Link } from "react-router-dom";
import { BUSINESS, GITHUB_REPO } from "../lib/links";

export function Footer({ version }: { version: string | null }) {
  return (
    <footer className="mt-20 border-t border-line bg-[#faf7f0]">
      <div className="mx-auto max-w-[1120px] px-6 pt-10 pb-11">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/mascot.png" alt="" className="h-[30px] w-[30px] object-contain" />
            <b className="font-extrabold">이지 하네스</b>
          </Link>
          <div className="flex flex-wrap items-center gap-[18px] text-[0.9rem]">
            <Link to="/terms" className="font-semibold text-txt-secondary transition hover:text-txt-primary">
              이용약관
            </Link>
            <Link
              to="/privacy"
              className="font-semibold text-txt-secondary transition hover:text-txt-primary"
            >
              개인정보처리방침
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener"
              className="font-semibold text-txt-secondary transition hover:text-txt-primary"
            >
              GitHub
            </a>
          </div>
        </div>
        <div className="mt-6 border-t border-line pt-[22px] text-[0.82rem] leading-[1.85] text-txt-tertiary">
          <div className="flex flex-wrap gap-x-[18px] gap-y-1">
            <span>상호 {BUSINESS.name}</span>
            <span>대표 {BUSINESS.ceo}</span>
            <span>사업자등록번호 {BUSINESS.bizNumber}</span>
          </div>
          <div className="flex flex-wrap gap-x-[18px] gap-y-1">
            <span>주소 {BUSINESS.address}</span>
            <span>문의 {BUSINESS.email}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.82rem] text-txt-tertiary">
          {version && <span className="font-mono">{version}</span>}
          <span>© 2026 니즈랩(NeedsLab). All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
