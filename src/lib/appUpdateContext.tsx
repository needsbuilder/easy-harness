import { createContext, useContext, type ReactNode } from "react";
import { useAppUpdate } from "./appUpdate";

type AppUpdateValue = ReturnType<typeof useAppUpdate>;

const AppUpdateContext = createContext<AppUpdateValue | null>(null);

// Provider가 없을 때의 안전한 기본값(업데이트 없음). 배너가 앱 셸에 항상 있으므로,
// 혹시 Provider 밖에서 렌더돼도 앱을 크래시시키지 않고 배너만 조용히 감춘다.
const IDLE_UPDATE: AppUpdateValue = {
  phase: { kind: "idle" },
  install: async () => {},
  checkNow: async () => "uptodate",
};

/**
 * 앱이 켜질 때 1회 업데이트를 확인하고 그 상태를 트리 전체에서 공유한다.
 * 예전에는 대시보드(내 도구) 화면에서만 확인이 돌아, 그 화면을 안 들르면
 * 업데이트 알림을 못 봤다. Provider를 App 루트에 두면 화면과 무관하게 앱 시작 시 확인된다.
 */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const value = useAppUpdate();
  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
}

export function useAppUpdateContext(): AppUpdateValue {
  return useContext(AppUpdateContext) ?? IDLE_UPDATE;
}
