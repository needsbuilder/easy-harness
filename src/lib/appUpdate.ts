import { useCallback, useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type AppUpdatePhase =
  | { kind: "idle" }
  | { kind: "available" }
  | { kind: "downloading"; percent: number | null } // null = 전체 크기를 몰라 진행률을 못 세는 상태
  | { kind: "failed" };

/** 설정 화면에서 "지금 확인"을 눌렀을 때의 결과 */
export type ManualCheckResult = "available" | "uptodate" | "error";

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

  /**
   * 설정 화면의 "지금 확인" 버튼용. 자동 확인은 앱을 켤 때 딱 1회라, 그때 인터넷이
   * 잠깐 끊겼으면 앱을 다시 켜기 전까지 새 버전을 못 본다. 그 막다른 길을 없애는 수동 경로다.
   * 배너용 phase 는 업데이트가 있을 때만 건드린다(없는데 배너가 깜빡이면 안 되니까).
   */
  const checkNow = useCallback(async (): Promise<ManualCheckResult> => {
    try {
      const u = await check();
      if (u) {
        setUpdate(u);
        setPhase({ kind: "available" });
        return "available";
      }
      return "uptodate";
    } catch {
      return "error";
    }
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    let total = 0;
    let received = 0;
    // 전체 크기를 아직 모르니 percent는 null(불확정)로 시작한다. 0%로 두면
    // 콘텐츠 길이가 안 오는 서버에서 영영 0%에 멈춘 것처럼 보인다.
    setPhase({ kind: "downloading", percent: null });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          if (total > 0) {
            const percent = Math.min(99, Math.round((received / total) * 100));
            setPhase({ kind: "downloading", percent });
          }
          // total을 모르면 percent는 null(불확정)인 채로 둔다
        }
      });
      await relaunch();
    } catch {
      setPhase({ kind: "failed" });
    }
  }, [update]);

  return { phase, install, checkNow };
}
