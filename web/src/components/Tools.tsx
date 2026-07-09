const harnesses = [
  { name: "Claude Code", icon: "/icons/claude-code.png" },
  { name: "Codex", icon: "/icons/codex.png" },
  { name: "GajaeCode", icon: "/icons/gajaecode.png" },
  { name: "OpenClaw", icon: "/icons/openclaw.png" },
  { name: "Hermes", icon: "/icons/hermes.png" },
  { name: "OpenCode", icon: "/icons/opencode.png" },
];

const plugins = ["인세인서치", "LazyCodex", "한국 법령 검색", "K-스킬", "임낫에이아이"];

export function Tools() {
  return (
    <section className="mx-auto max-w-[1120px] px-6 pt-6 pb-20">
      <div className="mx-auto max-w-[640px] text-center">
        <span className="font-mono text-[0.76rem] font-semibold tracking-[0.2em] text-txt-gold uppercase">
          지원 도구
        </span>
        <h2 className="mt-2.5 text-[clamp(1.7rem,3vw,2.35rem)] font-extrabold tracking-[-0.03em]">
          이런 도구들을 챙겨요
        </h2>
      </div>
      <div className="mt-11 grid grid-cols-1 gap-[18px] md:grid-cols-3">
        {harnesses.map((t) => (
          <div
            key={t.name}
            className="flex items-center gap-4 rounded-2xl border border-line bg-surface-card px-5 py-[18px] shadow-[0_1px_4px_rgba(42,32,24,0.06)] transition hover:-translate-y-[3px] hover:border-surface-gold-tint hover:shadow-[0_18px_48px_rgba(42,32,24,0.13)]"
          >
            <img
              src={t.icon}
              alt=""
              className="h-13 w-13 shrink-0 rounded-[13px] object-cover shadow-[0_1px_4px_rgba(42,32,24,0.06)]"
            />
            <span className="text-[1.05rem] font-extrabold">{t.name}</span>
          </div>
        ))}
      </div>
      <div className="mt-11 text-center">
        <p className="font-bold text-txt-secondary">오픈소스 플러그인도 함께 챙겨요</p>
        <div className="mt-[18px] flex flex-wrap justify-center gap-3">
          {plugins.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(216,172,59,0.35)] bg-surface-gold-tint px-[18px] py-2.5 text-[0.95rem] font-bold text-txt-gold"
            >
              <span className="h-[7px] w-[7px] rounded-full bg-brand-hover" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
