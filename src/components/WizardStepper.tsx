export function WizardStepper({ current, toolName, helperNames = [], failed = false }: {
  current: 1 | 2 | 3 | 4; toolName: string; helperNames?: string[]; failed?: boolean;
}) {
  const helperLabel = helperNames.length > 0 ? `${helperNames.join("·")} 설치` : "준비물 설치";
  const labels = ["컴퓨터 점검", helperLabel, `${toolName} 설치`, "마무리"];
  return (
    <ol className="flex items-center justify-center gap-3">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const done = n < current;
        const active = n === current;
        // 멈춘 단계는 완료(✓)로 그리지 않는다. 아무것도 안 깔렸는데 깔린 것처럼 보이면
        // 사용자가 "마무리만 실패했나 보다"로 오해한다.
        const stopped = failed && active;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-badge font-bold ${
                stopped ? "bg-status-error-tint text-status-error"
                : done ? "bg-surface-gold-tint text-status-success"
                : active ? "bg-gold-gradient text-txt-on-brand"
                : "bg-surface-card-hover text-txt-tertiary"
              }`}
              aria-hidden
            >
              {stopped ? "!" : done ? "✓" : n}
            </span>
            <span className={active ? "font-bold" : "text-txt-tertiary"}>
              {label}
              {stopped && <span className="sr-only"> (여기서 멈췄어요)</span>}
            </span>
            {n < 4 && <span className="h-px w-10 bg-line dark:bg-line-dark" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
