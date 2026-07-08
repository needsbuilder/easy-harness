import { useEffect, useState } from "react";
import { pickAssets, RELEASES_API, type Picks } from "./releases";

type GithubRelease = {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
};

/**
 * 마운트 시 GitHub API로 최신 릴리스를 읽어 OS/칩별 설치 파일 링크를 만든다.
 * 자산 이름에 버전이 박혀 있어(예: Easy.Harness_0.1.2_aarch64.dmg) 하드코딩 링크는
 * 다음 릴리스에 깨지므로, 매번 최신을 동적으로 물어온다. 실패하면 failed=true(폴백은 버튼에서).
 */
export function useLatestRelease() {
  const [picks, setPicks] = useState<Picks>({});
  const [version, setVersion] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(RELEASES_API)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: GithubRelease) => {
        if (cancelled) return;
        setVersion(data.tag_name);
        setPicks(
          pickAssets(data.assets.map((a) => ({ name: a.name, url: a.browser_download_url }))),
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { picks, version, failed };
}
