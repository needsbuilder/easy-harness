import { useState } from "react";
import { PrimaryButton } from "../components/Buttons";
import { exportDiagnostics } from "../lib/ipc";

export function Settings() {
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <h1 className="text-title font-extrabold">설정</h1>
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
