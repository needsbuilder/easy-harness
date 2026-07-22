export type OS = "mac" | "windows" | "other";
export type Asset = { name: string; url: string };
export type Picks = { macArm?: Asset; macIntel?: Asset; winExe?: Asset; winMsi?: Asset };

export const RELEASES_API =
  "https://api.github.com/repos/needsbuilder/easy-harness/releases/latest";
export const RELEASES_LATEST_PAGE =
  "https://github.com/needsbuilder/easy-harness/releases/latest";

/** 브라우저 UA/플랫폼 문자열로 OS를 추정한다. */
export function detectOS(ua: string, platform = ""): OS {
  const s = `${ua} ${platform}`.toLowerCase();
  if (s.includes("win")) return "windows";
  if (s.includes("mac")) return "mac";
  return "other";
}

/**
 * 릴리스 자산 배열에서 파일명 규칙으로 설치 파일을 분류한다.
 * 맥 애플실리콘 = *_aarch64.dmg, 맥 인텔 = *_x64.dmg,
 * 윈도우 = *_x64-setup.exe(nsis) / *_en-US.msi. tar.gz·sig·latest.json은 제외된다.
 */
export function pickAssets(assets: Asset[]): Picks {
  const find = (pred: (n: string) => boolean) => assets.find((a) => pred(a.name));
  return {
    macArm: find((n) => n.endsWith("aarch64.dmg")),
    macIntel: find((n) => n.endsWith("x64.dmg")),
    winExe: find((n) => n.endsWith("x64-setup.exe")),
    winMsi: find((n) => n.endsWith("_en-US.msi")),
  };
}
