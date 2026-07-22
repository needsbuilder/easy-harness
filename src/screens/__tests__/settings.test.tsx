import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { Settings } from "../Settings";
import { AppUpdateProvider } from "../../lib/appUpdateContext";

// Settings 가 업데이트 컨텍스트를 쓰므로 Provider 로 감싸야 한다.
// 안 감싸면 "업데이트 없음" 기본값이 걸려 확인 결과가 항상 uptodate 로 나온다.
const renderSettings = () =>
  render(
    <AppUpdateProvider>
      <Settings />
    </AppUpdateProvider>,
  );

const { mockCheck } = vi.hoisted(() => ({ mockCheck: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mockCheck }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: async () => "0.1.3" }));

describe("설정 화면", () => {
  // Provider 가 마운트될 때마다 check() 를 부르므로 기본값을 깔아 둔다.
  // 안 그러면 업데이트를 다루지 않는 테스트에서 undefined.then 으로 터진다.
  beforeEach(() => {
    mockCheck.mockReset();
    mockCheck.mockResolvedValue(null);
  });

  // 이 프로젝트는 vitest globals 를 켜지 않아 testing-library 자동 정리가 안 돈다.
  // 직접 cleanup 하지 않으면 앞 테스트의 화면이 남아 같은 버튼이 여러 개로 잡힌다.
  afterEach(() => {
    clearMocks();
    cleanup();
  });

  it("진단 파일을 저장하고 결과 안내를 보여준다", async () => {
    mockIPC((cmd) => {
      if (cmd === "export_diagnostics") return "/Users/me/Downloads/easy-harness-diagnostics-1.zip";
    });
    renderSettings();
    screen.getByRole("button", { name: "진단 파일 저장하기" }).click();
    expect(await screen.findByText(/다운로드 폴더에 저장했어요/)).toBeInTheDocument();
  });

  it("지금 쓰는 버전을 보여준다", async () => {
    renderSettings();
    expect(await screen.findByText(/지금 쓰고 계신 버전은 0.1.3이에요/)).toBeInTheDocument();
  });

  it("최신이면 그렇다고 알려준다", async () => {
    mockCheck.mockResolvedValue(null);
    renderSettings();
    screen.getByRole("button", { name: "새 버전 확인하기" }).click();
    expect(await screen.findByText(/지금이 가장 최신 버전이에요/)).toBeInTheDocument();
  });

  it("새 버전이 있으면 위쪽 알림으로 안내한다", async () => {
    mockCheck.mockResolvedValue({ downloadAndInstall: vi.fn() });
    renderSettings();
    screen.getByRole("button", { name: "새 버전 확인하기" }).click();
    expect(await screen.findByText(/새 버전이 나왔어요/)).toBeInTheDocument();
  });

  it("확인이 안 되면 다시 눌러보라고 안내한다", async () => {
    mockCheck.mockRejectedValue(new Error("offline"));
    renderSettings();
    screen.getByRole("button", { name: "새 버전 확인하기" }).click();
    expect(await screen.findByText(/인터넷 연결을 확인하고 다시 눌러 주세요/)).toBeInTheDocument();
  });
});
