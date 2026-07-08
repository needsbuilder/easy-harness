const harnesses = [
  { name: "Claude Code", icon: "/icons/claude-code.png" },
  { name: "Codex", icon: "/icons/codex.png" },
  { name: "GajaeCode", icon: "/icons/gajaecode.png" },
  { name: "OpenClaw", icon: "/icons/openclaw.png" },
  { name: "Hermes", icon: "/icons/hermes.png" },
  { name: "OpenCode", icon: "/icons/opencode.png" },
];

// 오픈소스 플러그인은 고유 공식 로고가 없어 전부 첫 글자 타일로 표기한다.
const plugins: { name: string; icon: string | null }[] = [
  { name: "인세인서치", icon: null },
  { name: "LazyCodex", icon: null },
  { name: "한국 법령 검색", icon: null },
  { name: "K-스킬", icon: null },
  { name: "임낫에이아이", icon: null },
];

function IconTile({ name, icon }: { name: string; icon: string | null }) {
  return (
    <div className="flex w-24 flex-col items-center gap-2.5">
      <div className="h-16 w-16 overflow-hidden rounded-2xl border border-line bg-surface-card shadow-[0_1px_4px_rgba(42,32,24,0.08)]">
        {icon ? (
          <img src={icon} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-surface-gold-tint text-2xl font-extrabold text-txt-gold">
            {name.charAt(0)}
          </span>
        )}
      </div>
      <span className="text-sm font-bold">{name}</span>
    </div>
  );
}

export function Tools() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10 text-center">
      <h2 className="text-2xl font-extrabold">되는 도구들</h2>
      <div className="mt-8 flex flex-wrap items-start justify-center gap-x-8 gap-y-6">
        {harnesses.map((t) => (
          <IconTile key={t.name} name={t.name} icon={t.icon} />
        ))}
      </div>
      <p className="mt-10 font-bold text-txt-secondary">오픈소스 · 플러그인도 함께 챙겨요</p>
      <div className="mt-5 flex flex-wrap items-start justify-center gap-x-8 gap-y-6">
        {plugins.map((t) => (
          <IconTile key={t.name} name={t.name} icon={t.icon} />
        ))}
      </div>
    </section>
  );
}
