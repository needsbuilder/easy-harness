import { PrimaryButton } from "./Buttons";
import { useAppUpdateContext } from "../lib/appUpdateContext";

/**
 * 앱 자체 업데이트 알림 배너. AppShell 상단에 떠서 주요 화면(하네스·플러그인·내 도구·설정)에서 보인다.
 * Welcome/Wizard/Success는 AppShell 밖이라 설치 흐름을 방해하지 않는다.
 */
export function UpdateBanner() {
  const { phase, install } = useAppUpdateContext();
  if (phase.kind === "idle") return null;

  return (
    <div className="mb-6 flex items-center justify-between rounded-card border border-line-gold bg-surface-gold-tint px-5 py-4">
      {phase.kind === "available" && (
        <>
          <p className="font-bold">이지 하네스 새 버전이 나왔어요. 1분이면 끝나요.</p>
          <PrimaryButton onClick={install}>지금 업데이트</PrimaryButton>
        </>
      )}
      {phase.kind === "downloading" && (
        <p className="font-bold">
          {phase.percent === null
            ? "새 버전을 받는 중이에요"
            : `새 버전을 받는 중이에요 ${phase.percent}%`}
        </p>
      )}
      {phase.kind === "failed" && (
        <p className="font-bold">업데이트를 받지 못했어요. 다음에 다시 시도할게요.</p>
      )}
    </div>
  );
}
