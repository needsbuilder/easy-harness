import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { PrimaryButton, SecondaryButton } from "../components/Buttons";
import { exportDiagnostics } from "../lib/ipc";
import { useAppUpdateContext } from "../lib/appUpdateContext";
import { type ManualCheckResult } from "../lib/appUpdate";

/** "지금 확인" 결과를 사용자 말로 옮긴 것 */
const CHECK_MESSAGE: Record<ManualCheckResult, string> = {
  uptodate: "지금이 가장 최신 버전이에요.",
  available: "새 버전이 나왔어요. 화면 위쪽 알림에서 바로 받을 수 있어요.",
  error: "확인하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.",
};

function AppVersionSection() {
  const { checkNow } = useAppUpdateContext();
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ManualCheckResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {
        /* 버전을 못 읽어도 확인 버튼은 그대로 쓸 수 있다 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-6 max-w-xl rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark p-6 shadow-card">
      <h2 className="font-bold">앱 버전</h2>
      <p className="mt-1 text-caption text-txt-tertiary">
        {version ? `지금 쓰고 계신 버전은 ${version}이에요.` : "버전을 읽는 중이에요."} 새 버전이
        나오면 앱을 켤 때 알려드려요. 지금 바로 확인해 볼 수도 있어요.
      </p>
      <SecondaryButton
        className="mt-4"
        disabled={checking}
        onClick={() => {
          setChecking(true);
          setResult(null);
          checkNow()
            .then(setResult)
            .finally(() => setChecking(false));
        }}
      >
        {checking ? "확인하고 있어요" : "새 버전 확인하기"}
      </SecondaryButton>
      {result && (
        <p
          className={`mt-3 font-bold ${
            result === "error" ? "text-status-error" : "text-status-success"
          }`}
        >
          {CHECK_MESSAGE[result]}
        </p>
      )}
    </section>
  );
}

export function Settings() {
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <h1 className="text-title font-extrabold">설정</h1>
      <AppVersionSection />
      <section className="mt-6 max-w-xl rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark p-6 shadow-card">
        <h2 className="font-bold">문제가 생겼나요?</h2>
        <p className="mt-1 text-caption text-txt-tertiary">
          무슨 일이 있었는지 담은 진단 파일을 만들어 드려요. 문의할 때 첨부하면 빨라요. 비밀값은 자동으로 가려져요.
        </p>
        <PrimaryButton
          className="mt-4"
          onClick={() => {
            setFailed(false);
            exportDiagnostics().then(setSaved).catch(() => setFailed(true));
          }}
        >
          진단 파일 저장하기
        </PrimaryButton>
        {saved && <p className="mt-3 font-bold text-status-success">다운로드 폴더에 저장했어요</p>}
        {failed && <p className="mt-3 font-bold text-status-error">저장이 안 됐어요. 다시 한 번 눌러 주세요.</p>}
      </section>
    </div>
  );
}
