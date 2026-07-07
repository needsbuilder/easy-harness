const steps = [
  { n: "1", title: "도구 고르기", desc: "쓰고 싶은 AI 코딩 도구를 카드에서 골라요." },
  { n: "2", title: "오공이가 설치하고 로그인해요", desc: "준비물부터 로그인까지 알아서 챙겨요." },
  { n: "3", title: "바로 사용", desc: "설치가 잘 됐는지 확인까지 하고 끝나요." },
];

export function Steps() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-center text-3xl font-extrabold">이렇게 쉬워요</h2>
      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-[16px] border border-line bg-surface-card p-6 text-center shadow-[0_1px_4px_rgba(42,32,24,0.06)]"
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-gold-tint text-xl font-extrabold text-txt-gold">
              {s.n}
            </span>
            <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
            <p className="mt-2 text-txt-secondary">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
