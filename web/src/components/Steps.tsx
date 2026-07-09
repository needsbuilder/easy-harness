const steps = [
  { n: "01", title: "도구 고르기", desc: "쓰고 싶은 AI 코딩 도구를 카드에서 골라요." },
  { n: "02", title: "오공이가 설치하고 로그인해요", desc: "준비물부터 로그인까지 알아서 챙겨요." },
  { n: "03", title: "바로 사용", desc: "설치가 잘 됐는지 확인까지 하고 끝나요." },
];

export function Steps() {
  return (
    <section className="mx-auto max-w-[1120px] px-6 py-20">
      <div className="mx-auto max-w-[640px] text-center">
        <span className="font-mono text-[0.76rem] font-semibold tracking-[0.2em] text-txt-gold uppercase">
          3단계면 끝나요
        </span>
        <h2 className="mt-2.5 text-[clamp(1.7rem,3vw,2.35rem)] font-extrabold tracking-[-0.03em]">
          이렇게 쉬워요
        </h2>
        <p className="mt-3 text-[1.05rem] text-txt-secondary">
          어려운 건 오공이가 대신 날아가서 해줘요.
        </p>
      </div>
      <div className="mt-13 grid grid-cols-1 gap-[22px] md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-[18px] border border-line bg-surface-card p-[30px_24px] shadow-[0_1px_4px_rgba(42,32,24,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(42,32,24,0.13)]"
          >
            <span className="mx-auto flex h-[66px] w-[66px] items-center justify-center rounded-full border-2 border-brand bg-surface-gold-tint font-mono text-[1.35rem] font-bold text-brand-hover">
              {s.n}
            </span>
            <h3 className="mt-[18px] text-center text-[1.16rem] font-extrabold break-keep">
              {s.title}
            </h3>
            <p className="mt-2 text-center text-[0.98rem] break-keep text-txt-secondary">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
