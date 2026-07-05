import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { onPtyData, ptyInput, ptyResize } from "../lib/ipc";

export function TerminalPanel({ sessionId }: { sessionId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({ convertEol: true, fontFamily: "JetBrains Mono Variable, monospace" });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    // 컨테이너 크기에 맞춰 칸수를 계산하고, 백엔드 PTY도 같은 크기로 맞춘다.
    // 둘이 어긋나면 CLI 출력이 화면 밖에서 잘린다.
    const refit = () => {
      fit.fit();
      void ptyResize(sessionId, term.cols, term.rows);
    };
    refit();
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(refit);
      ro.observe(hostRef.current);
    }
    const sub = term.onData((data) => { void ptyInput(sessionId, data); });
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void onPtyData(sessionId, (data) => { if (!cancelled) term.write(data); }).then((un) => {
      if (cancelled) { un(); return; }
      unlisten = un;
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      sub.dispose();
      unlisten?.();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div className="mt-8 h-[420px] overflow-hidden rounded-card border border-line dark:border-line-dark bg-[#111111] p-3 text-left" ref={hostRef} />
  );
}
