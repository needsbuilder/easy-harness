import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { MemoryRouter } from "react-router";
import { Dashboard } from "../Dashboard";
import type { CatalogEntry, Installation } from "../../lib/types";

function MemoryRouterWrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function inst(recipeId: string, overrides: Partial<Installation> = {}): Installation {
  return { recipeId, version: "1.0.0", installedAt: 1, authDone: true, verifiedAt: 2, ...overrides };
}

function harness(overrides: Partial<CatalogEntry> & { id: string; name: string }): CatalogEntry {
  return {
    kind: "harness",
    easyDescription: "",
    pricing: { label: "무료", kind: "free" },
    supportedModels: [],
    recommended: false,
    requires: [],
    installed: false,
    installedVersion: null,
    missingRequires: [],
    platforms: ["mac", "windows"],
    available: true,
    source: null,
    ...overrides,
  };
}

function plugin(overrides: Partial<CatalogEntry> & { id: string; name: string }): CatalogEntry {
  return {
    kind: "plugin",
    easyDescription: "",
    pricing: { label: "무료", kind: "free" },
    supportedModels: [],
    recommended: false,
    requires: [],
    installed: false,
    installedVersion: null,
    missingRequires: [],
    platforms: ["mac", "windows"],
    available: true,
    source: null,
    ...overrides,
  };
}

describe("내 도구", () => {
  afterEach(() => {
    cleanup();
    clearMocks();
    vi.restoreAllMocks();
  });

  it("설치 목록과 버전을 보여준다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_app_state") {
        return { installations: [{ recipeId: "mock-tool", version: "1.2.3", installedAt: 1, authDone: true, verifiedAt: 2 }] };
      }
      if (cmd === "list_catalog") {
        return [{
          id: "mock-tool", name: "모의 도구", kind: "harness", easyDescription: "",
          pricing: { label: "무료", kind: "free" }, supportedModels: [], recommended: false,
          requires: [], installed: true, installedVersion: "1.2.3", missingRequires: [],
        }];
      }
    });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText("모의 도구")).toBeInTheDocument();
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
    expect(screen.getByText(/설치한 도구는 1개예요/)).toBeInTheDocument();
  });

  it("버전을 모르면 물음표 대신 설치한 날짜를 보여준다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_app_state") {
        return { installations: [inst("mock-tool", { version: null, installedAt: 1783323963 })] };
      }
      if (cmd === "list_catalog") {
        return [harness({ id: "mock-tool", name: "모의 도구", installed: true })];
      }
    });
    render(<Dashboard />, { wrapper: MemoryRouterWrapper });
    await screen.findByText("모의 도구");
    expect(screen.queryByText("v?")).not.toBeInTheDocument();
    expect(screen.getByText(/설치했어요/)).toBeInTheDocument();
  });

  it("새 버전 확인 기능이 생기기 전에는 최신 상태 배지와 매일 확인 문구를 보여주지 않는다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_app_state") {
        return { installations: [inst("mock-tool")] };
      }
      if (cmd === "list_catalog") {
        return [harness({ id: "mock-tool", name: "모의 도구", installed: true })];
      }
    });
    render(<Dashboard />, { wrapper: MemoryRouterWrapper });
    await screen.findByText("모의 도구");
    expect(screen.queryByText("최신 상태예요")).not.toBeInTheDocument();
    expect(screen.queryByText(/매일 새 버전/)).not.toBeInTheDocument();
  });

  it("빈 목록이면 카탈로그로 안내한다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_app_state") return { installations: [] };
      if (cmd === "list_catalog") return [];
    });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText(/아직 설치한 도구가 없어요/)).toBeInTheDocument();
  });

  it("앱 업데이트 배너는 M2에서 숨겨져 있다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_app_state") return { installations: [] };
      if (cmd === "list_catalog") return [];
    });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await screen.findByText(/아직 설치한 도구가 없어요/);
    expect(screen.queryByText(/새 버전이 나왔어요/)).not.toBeInTheDocument();
  });

  it("삭제 버튼을 연속으로 두 번 눌러도 uninstall 플로우는 한 번만 시작된다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let startFlowCalls = 0;
    mockIPC((cmd) => {
      if (cmd === "get_app_state") {
        return { installations: [{ recipeId: "mock-tool", version: "1.2.3", installedAt: 1, authDone: true, verifiedAt: 2 }] };
      }
      if (cmd === "list_catalog") {
        return [{
          id: "mock-tool", name: "모의 도구", kind: "harness", easyDescription: "",
          pricing: { label: "무료", kind: "free" }, supportedModels: [], recommended: false,
          requires: [], installed: true, installedVersion: "1.2.3", missingRequires: [],
        }];
      }
      if (cmd === "start_flow") {
        startFlowCalls += 1;
        return "run-1";
      }
    }, { shouldMockEvents: true });

    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    const button = await screen.findByRole("button", { name: "삭제" });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(startFlowCalls).toBe(1));
    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "지우는 중" })).toBeInTheDocument();
  });

  it("플러그인이 얹혀 있는 하네스를 지울 때 경고를 함께 보여준다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_app_state") {
        return { installations: [inst("codex"), inst("lazycodex")] };
      }
      if (cmd === "list_catalog") {
        return [
          harness({ id: "codex", name: "Codex", installed: true }),
          plugin({ id: "lazycodex", name: "lazycodex", requires: ["codex"], installed: true }),
        ];
      }
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Dashboard />, { wrapper: MemoryRouterWrapper });
    fireEvent.click((await screen.findAllByText("삭제"))[0]);
    expect(confirmSpy.mock.calls[0][0]).toContain("lazycodex도 함께 멈출 수 있어요");
  });

  it("설치되지 않은 플러그인은 삭제 경고에서 제외한다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_app_state") {
        return { installations: [inst("codex"), inst("lazycodex")] };
      }
      if (cmd === "list_catalog") {
        return [
          harness({ id: "codex", name: "Codex", installed: true }),
          plugin({ id: "lazycodex", name: "lazycodex", requires: ["codex"], installed: true }),
          plugin({ id: "insane-search", name: "insane-search", requires: ["codex"], installed: false }),
        ];
      }
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Dashboard />, { wrapper: MemoryRouterWrapper });
    fireEvent.click((await screen.findAllByText("삭제"))[0]);
    expect(confirmSpy.mock.calls[0][0]).toContain("lazycodex도 함께 멈출 수 있어요");
    expect(confirmSpy.mock.calls[0][0]).not.toContain("insane-search");
  });
});
