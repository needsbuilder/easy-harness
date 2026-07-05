export function AuthGuidePanel({ guide }: { guide: string[] }) {
  if (guide.length === 0) return null;
  return (
    <div className="mt-8 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
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
