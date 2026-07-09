import { type ReactNode } from "react";
import { Link } from "react-router-dom";

/** 이용약관·개인정보처리방침 같은 문서 페이지 공통 레이아웃 */
export function DocLayout({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-[#faf7f0]">
        <div className="mx-auto flex max-w-[820px] items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/mascot.png" alt="" className="h-[30px] w-[30px] object-contain" />
            <b className="font-extrabold">이지 하네스</b>
          </Link>
          <Link to="/" className="text-[0.9rem] font-bold text-txt-gold transition hover:text-brand">
            홈으로
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[820px] px-6 pt-12 pb-24">
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 text-[0.9rem] text-txt-tertiary">시행일 {effectiveDate}</p>
        <div className="doc-body">{children}</div>
      </main>
    </div>
  );
}
