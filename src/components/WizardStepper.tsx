export function WizardStepper({ current, toolName }: { current: 1 | 2 | 3 | 4; toolName: string }) {
  const labels = ["컴퓨터 점검", "준비물 설치", `${toolName} 설치`, "마무리"];
  return (
    <ol className="flex items-center justify-center gap-3">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-badge font-bold ${
                done ? "bg-surface-gold-tint text-status-success"
                : active ? "bg-gold-gradient text-txt-on-brand"
                : "bg-surface-card-hover text-txt-tertiary"
              }`}
              aria-hidden
            >
              {done ? "✓" : n}
            </span>
            <span className={active ? "font-bold" : "text-txt-tertiary"}>{label}</span>
            {n < 4 && <span className="h-px w-10 bg-line dark:bg-line-dark" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
