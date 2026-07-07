import { describe, it, expect } from "vitest";
import { detectOS, pickAssets } from "../releases";

const assets = [
  { name: "Easy.Harness_0.1.2_aarch64.dmg", url: "u/arm.dmg" },
  { name: "Easy.Harness_0.1.2_x64.dmg", url: "u/intel.dmg" },
  { name: "Easy.Harness_0.1.2_x64-setup.exe", url: "u/setup.exe" },
  { name: "Easy.Harness_0.1.2_x64_en-US.msi", url: "u/app.msi" },
  { name: "Easy.Harness_0.1.2_aarch64.app.tar.gz", url: "u/x" },
  { name: "latest.json", url: "u/latest.json" },
];

describe("detectOS", () => {
  it("맥 UA는 mac", () => {
    expect(detectOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("mac");
  });
  it("윈도우 UA는 windows", () => {
    expect(detectOS("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
  });
  it("그 외는 other", () => {
    expect(detectOS("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
  });
});

describe("pickAssets", () => {
  it("파일명 규칙으로 맥 arm/intel·윈도우 exe/msi를 고른다", () => {
    const p = pickAssets(assets);
    expect(p.macArm?.name).toContain("aarch64.dmg");
    expect(p.macIntel?.name).toContain("x64.dmg");
    expect(p.winExe?.name).toContain("x64-setup.exe");
    expect(p.winMsi?.name).toContain("x64_en-US.msi");
  });
  it("dmg가 아닌 aarch64.app.tar.gz를 macArm으로 잘못 고르지 않는다", () => {
    expect(pickAssets(assets).macArm?.name.endsWith(".dmg")).toBe(true);
  });
  it("x64.dmg를 macIntel로만 고르고 macArm(aarch64)과 헷갈리지 않는다", () => {
    const p = pickAssets(assets);
    expect(p.macIntel?.url).toBe("u/intel.dmg");
    expect(p.macArm?.url).toBe("u/arm.dmg");
  });
});
