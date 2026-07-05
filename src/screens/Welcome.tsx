import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PrimaryButton } from "../components/Buttons";
import { getEnvReport } from "../lib/ipc";
import type { EnvReport } from "../lib/types";
import mascot from "../assets/mascot.png";

export function Welcome() {
  const [report, setReport] = useState<EnvReport | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getEnvReport().then(setReport).catch(() => setReport(null));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-bg dark:bg-surface-bg-dark px-6 py-10">
      <img src={mascot} alt="근두운을 탄 오공이" className="h-40 w-40 object-contain" />
      <h1 className="mt-6 text-display font-extrabold">AI 도구, 3분이면 준비 끝나요</h1>
      <p className="mt-2 text-txt-secondary dark:text-txt-secondary-dark">
        어려운 설치는 오공이가 대신해요. 버튼만 눌러 주세요.
      </p>
      <section className="mt-8 w-full max-w-xl rounded-card border border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark p-6 shadow-card">
        <h2 className="text-caption font-bold text-txt-secondary dark:text-txt-secondary-dark">내 컴퓨터 점검 결과</h2>
        {report ? (
          <ul className="mt-4 space-y-3">
            <li className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-gold-tint text-status-success" aria-hidden>✓</span>
              <span className="font-bold">{report.osLabel}에서 사용할 수 있어요</span>
            </li>
            {report.missingCount === 0 ? (
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-gold-tint text-status-success" aria-hidden>✓</span>
                <span className="font-bold">준비물도 모두 갖춰져 있어요</span>
              </li>
            ) : (
              <li className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-gold-tint font-bold text-txt-gold" aria-hidden>
                  {report.missingCount}
                </span>
                <span>
                  <span className="font-bold">준비물 {report.missingCount}개가 필요해요</span>
                  <br />
                  <span className="text-caption text-txt-tertiary">
                    도구를 설치할 때 오공이가 알아서 챙겨요. 지금은 몰라도 돼요
                  </span>
                </span>
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-4 text-txt-tertiary">점검 중이에요...</p>
        )}
      </section>
      <PrimaryButton className="mt-8" onClick={() => navigate("/catalog")}>
        도구 고르러 가기
      </PrimaryButton>
    </div>
  );
}
