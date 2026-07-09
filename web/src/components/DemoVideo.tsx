export function DemoVideo() {
  return (
    <section className="mx-auto max-w-[1120px] px-6 pt-6 pb-20">
      <div className="mx-auto max-w-[640px] text-center">
        <span className="font-mono text-[0.76rem] font-semibold tracking-[0.2em] text-txt-gold uppercase">
          직접 보세요
        </span>
        <h2 className="mt-2.5 text-[clamp(1.7rem,3vw,2.35rem)] font-extrabold tracking-[-0.03em]">
          이런 화면이에요
        </h2>
      </div>
      <div className="mt-11 overflow-hidden rounded-[18px] border border-line bg-surface-card shadow-[0_18px_48px_rgba(42,32,24,0.13)]">
        {/* 창 상단 신호등 */}
        <div className="flex items-center gap-2 border-b border-line bg-gradient-to-b from-[#fdf7ea] to-[#f8efdb] px-[18px] py-[13px]">
          <span className="h-3 w-3 rounded-full bg-[#E8A317]" />
          <span className="h-3 w-3 rounded-full bg-line" />
          <span className="h-3 w-3 rounded-full bg-line" />
          <span className="ml-3.5 font-mono text-[0.78rem] text-txt-tertiary">이지 하네스</span>
        </div>
        <video
          className="aspect-video w-full bg-surface-gold-tint object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/demo-poster.png"
        >
          <source src="/demo.mp4" type="video/mp4" />
        </video>
      </div>
    </section>
  );
}
