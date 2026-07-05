export function LogPanel({ lines, visible }: { lines: string[]; visible: boolean }) {
  if (!visible) return null;
  return (
    <pre className="mt-4 max-h-56 overflow-auto rounded-card bg-surface-card-dark p-4 font-mono text-caption text-txt-primary-dark">
      {lines.join("\n") || "아직 보여줄 과정이 없어요"}
    </pre>
  );
}
