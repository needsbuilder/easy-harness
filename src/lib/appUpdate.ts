import { useCallback, useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type AppUpdatePhase =
  | { kind: "idle" }
  | { kind: "available" }
  | { kind: "downloading"; percent: number }
  | { kind: "failed" };

/** 앱 자체 업데이트 훅. 마운트 시 1회 조용히 확인하고, install()로 내려받아 재시작한다. */
export function useAppUpdate() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<AppUpdatePhase>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    check()
      .then((u) => {
        if (!cancelled && u) {
          setUpdate(u);
          setPhase({ kind: "available" });
        }
      })
      .catch(() => {
        /* 확인 실패는 사용자를 귀찮게 하지 않는다 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    let total = 0;
    let received = 0;
    setPhase({ kind: "downloading", percent: 0 });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          if (total > 0) {
            const percent = Math.min(99, Math.round((received / total) * 100));
            setPhase({ kind: "downloading", percent });
          }
        }
      });
      await relaunch();
    } catch {
      setPhase({ kind: "failed" });
    }
  }, [update]);

  return { phase, install };
}
