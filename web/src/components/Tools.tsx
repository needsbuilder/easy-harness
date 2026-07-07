const tools = ["Claude Code", "Codex", "GajaeCode", "OpenClaw", "Hermes", "OpenCode"];

export function Tools() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-10 text-center">
      <h2 className="text-2xl font-extrabold">되는 도구들</h2>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {tools.map((t) => (
          <span
            key={t}
            className="rounded-full border border-line bg-surface-card px-4 py-2 font-bold"
          >
            {t}
          </span>
        ))}
      </div>
      <p className="mt-5 text-txt-secondary">플러그인과 오픈소스도 함께 챙겨요.</p>
    </section>
  );
}
