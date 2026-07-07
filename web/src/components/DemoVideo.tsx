export function DemoVideo() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-8">
      <div className="overflow-hidden rounded-[16px] border border-line bg-surface-card shadow-[0_12px_40px_rgba(42,32,24,0.12)]">
        {/* 창 상단 신호등 */}
        <div className="flex items-center gap-2 border-b border-line bg-surface-gold-tint px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#E8A317]" />
          <span className="h-3 w-3 rounded-full bg-line" />
          <span className="h-3 w-3 rounded-full bg-line" />
        </div>
        <video
          className="aspect-video w-full bg-surface-gold-tint"
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
