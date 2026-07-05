import mascot from "../assets/mascot.png";

export function MascotBubble({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <img src={mascot} alt="오공이" className="h-12 w-12 object-contain" />
      <div className="rounded-[20px] bg-surface-card dark:bg-surface-card-dark shadow-card px-4 py-3 text-body">
        {text}
      </div>
    </div>
  );
}
