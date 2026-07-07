import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AppShell } from "../../components/AppShell";
import { AppUpdateProvider } from "../appUpdateContext";

const { mockCheck, mockRelaunch } = vi.hoisted(() => ({
  mockCheck: vi.fn(),
  mockRelaunch: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mockCheck }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mockRelaunch }));

beforeEach(() => {
  mockCheck.mockReset();
  mockRelaunch.mockReset();
});
afterEach(() => {
  cleanup();
});

describe("AppUpdateProvider (앱 시작 시 전역 확인)", () => {
  it("대시보드가 아닌 화면에서도 앱 시작 시 확인해 배너를 띄운다", async () => {
    // 내 도구(Dashboard)를 전혀 마운트하지 않고, AppShell만 있는 화면에서 배너가 떠야 한다
    mockCheck.mockResolvedValue({ downloadAndInstall: vi.fn() });

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AppUpdateProvider>
          <AppShell />
        </AppUpdateProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/새 버전이 나왔어요/)).toBeInTheDocument();
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  it("업데이트가 없으면 배너를 띄우지 않는다", async () => {
    mockCheck.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AppUpdateProvider>
          <AppShell />
        </AppUpdateProvider>
      </MemoryRouter>,
    );

    await vi.waitFor(() => expect(mockCheck).toHaveBeenCalled());
    expect(screen.queryByText(/새 버전이 나왔어요/)).not.toBeInTheDocument();
  });
});
