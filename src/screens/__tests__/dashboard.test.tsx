import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { MemoryRouter } from "react-router";
import { Dashboard } from "../Dashboard";

describe("내 도구", () => {
  afterEach(() => clearMocks());

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
});
