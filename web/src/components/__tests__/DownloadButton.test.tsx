// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DownloadButton } from "../DownloadButton";
import { RELEASES_LATEST_PAGE, type Picks } from "../../lib/releases";

const full: Picks = {
  macArm: { name: "Easy.Harness_0.1.5_aarch64.dmg", url: "u/arm.dmg" },
  macIntel: { name: "Easy.Harness_0.1.5_x64.dmg", url: "u/intel.dmg" },
  winExe: { name: "Easy.Harness_0.1.5_x64-setup.exe", url: "u/setup.exe" },
  winMsi: { name: "Easy.Harness_0.1.5_x64_en-US.msi", url: "u/app.msi" },
};

// 이 프로젝트는 vitest globals를 안 써서 자동 cleanup이 안 돈다 (HANDOFF 실측)
afterEach(cleanup);

describe("DownloadButton", () => {
  it("자산이 다 있으면 윈도우·맥(애플 실리콘) 버튼과 인텔 맥 링크를 함께 보여준다", () => {
    render(<DownloadButton picks={full} failed={false} />);
    expect(screen.getByRole("link", { name: /윈도우용 다운로드/ })).toHaveAttribute(
      "href",
      "u/setup.exe",
    );
    expect(screen.getByRole("link", { name: /맥용 다운로드/ })).toHaveAttribute("href", "u/arm.dmg");
    expect(screen.getByRole("link", { name: /인텔 맥용 설치 파일/ })).toHaveAttribute(
      "href",
      "u/intel.dmg",
    );
  });

  it("인텔 맥 사용자가 받을 길이 사라지지 않는다 (회귀 방지: 랜딩에 인텔 다운로드 부재)", () => {
    render(<DownloadButton picks={full} failed={false} />);
    const intelLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "u/intel.dmg");
    expect(intelLinks.length).toBeGreaterThan(0);
  });

  it("애플 실리콘 자산이 없으면 인텔 dmg가 맥 버튼 자리를 대신한다", () => {
    render(<DownloadButton picks={{ ...full, macArm: undefined }} failed={false} />);
    expect(screen.getByRole("link", { name: /맥용 다운로드/ })).toHaveAttribute(
      "href",
      "u/intel.dmg",
    );
    // 버튼이 이미 인텔용이므로 안내 문장은 중복이라 안 보여준다
    expect(screen.queryByText(/인텔 칩 맥이라면/)).toBeNull();
  });

  it("인텔 dmg가 없으면 안내 문장을 보여주지 않는다", () => {
    render(<DownloadButton picks={{ ...full, macIntel: undefined }} failed={false} />);
    expect(screen.queryByText(/인텔 칩 맥이라면/)).toBeNull();
  });

  it("자산 조회 실패 시 릴리스 페이지로 가는 단일 버튼만 보여준다", () => {
    render(<DownloadButton picks={{}} failed={true} />);
    expect(screen.getByRole("link", { name: "다운로드" })).toHaveAttribute(
      "href",
      RELEASES_LATEST_PAGE,
    );
  });
});
