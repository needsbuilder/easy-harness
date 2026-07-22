import { useEffect, useState } from "react";
import { GITHUB_REPO_API } from "./links";

/** 1000 이상은 1.2k 처럼 줄여 쓴다. 별 개수는 정확한 값보다 규모가 중요하다. */
export function formatStars(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  // 10k 이상은 소수점을 떼서 자릿수가 늘어나지 않게 한다
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * 저장소 스타 개수를 읽어 온다. 실패하면 null 이고, 화면에서는 숫자만 감춘다.
 * GitHub API 는 인증 없이 시간당 60회 제한이라 회사 공용 IP 등에서는 막힐 수 있는데,
 * 그때도 GitHub 버튼 자체는 그대로 보여야 하므로 실패를 조용히 삼킨다.
 */
export function useGithubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(GITHUB_REPO_API)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { stargazers_count?: number }) => {
        if (cancelled) return;
        if (typeof data.stargazers_count === "number") setStars(data.stargazers_count);
      })
      .catch(() => {
        /* 별 개수는 없어도 그만이다 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return stars;
}
