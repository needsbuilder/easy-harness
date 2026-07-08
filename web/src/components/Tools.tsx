const tools = [
  { name: "Claude Code", icon: "/icons/claude-code.png" },
  { name: "Codex", icon: "/icons/codex.png" },
  { name: "GajaeCode", icon: "/icons/gajaecode.png" },
  { name: "OpenClaw", icon: "/icons/openclaw.png" },
  { name: "Hermes", icon: "/icons/hermes.png" },
  { name: "OpenCode", icon: "/icons/opencode.png" },
];

export function Tools() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10 text-center">
      <h2 className="text-2xl font-extrabold">되는 도구들</h2>
      <div className="mt-8 flex flex-wrap items-start justify-center gap-x-8 gap-y-6">
        {tools.map((t) => (
          <div key={t.name} className="flex w-24 flex-col items-center gap-2.5">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-line shadow-[0_1px_4px_rgba(42,32,24,0.08)]">
              <img src={t.icon} alt={t.name} className="h-full w-full object-cover" />
            </div>
            <span className="text-sm font-bold">{t.name}</span>
          </div>
        ))}
      </div>
      <p className="mt-8 text-txt-secondary">플러그인과 오픈소스도 함께 챙겨요.</p>
    </section>
  );
}
