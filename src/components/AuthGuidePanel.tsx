export function AuthGuidePanel({ guide, stacked = false }: { guide: string[]; stacked?: boolean }) {
  if (guide.length === 0) return null;
  return (
    // stacked: 터미널 옆처럼 좁은 자리에 놓일 때. 3열을 유지하면 카드 하나가
    // 글자 두어 자 폭으로 부서지므로 세로로 쌓는다.
    <div className={`mt-8 grid w-full grid-cols-1 gap-4 ${stacked ? "" : "md:grid-cols-3"}`}>
      {guide.map((text, i) => (
        <div
          key={text}
          className="rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark p-6 text-left shadow-card"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-gold-tint font-bold text-txt-gold">
            {i + 1}
          </span>
          <p className="mt-3 font-bold">{text}</p>
        </div>
      ))}
    </div>
  );
}
