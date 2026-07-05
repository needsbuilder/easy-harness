import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { onPtyData, ptyInput } from "../lib/ipc";

export function TerminalPanel({ sessionId }: { sessionId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({ cols: 100, rows: 30, convertEol: true, fontFamily: "JetBrains Mono Variable, monospace" });
    term.open(hostRef.current);
    const sub = term.onData((data) => { void ptyInput(sessionId, data); });
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void onPtyData(sessionId, (data) => { if (!cancelled) term.write(data); }).then((un) => {
      if (cancelled) { un(); return; }
      unlisten = un;
    });
    return () => {
      cancelled = true;
      sub.dispose();
      unlisten?.();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div className="mt-8 overflow-hidden rounded-card border border-line dark:border-line-dark bg-[#111111] p-3 text-left" ref={hostRef} />
  );
}
