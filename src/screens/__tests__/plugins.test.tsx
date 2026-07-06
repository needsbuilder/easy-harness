import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { MemoryRouter } from "react-router";
import { Plugins } from "../Plugins";
import type { CatalogEntry } from "../../lib/types";

function MemoryRouterWrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function harness(overrides: Partial<CatalogEntry> & { id: string; name: string }): CatalogEntry {
  return {
    kind: "harness",
    easyDescription: "설치 흐름을 시험하는 가짜 도구예요",
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
    easyDescription: "쓰던 도구를 더 똑똑하게 만들어 주는 부품이에요",
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

describe("Plugins", () => {
  afterEach(() => {
    cleanup();
    clearMocks();
  });

  it("플러그인 카드만 그리고, 대상 하네스 이름을 보여준다", async () => {
    const entries = [
      harness({ id: "claude-code", name: "Claude Code", installed: false }),
      plugin({ id: "im-not-ai", name: "I'm Not AI", requires: ["claude-code"], missingRequires: ["claude-code"] }),
      plugin({ id: "korean-law-mcp", name: "한국 법령 검색", requires: ["claude-code"], missingRequires: [] }),
    ];
    mockIPC((cmd) => {
      if (cmd === "list_catalog") return entries;
    });

    render(<Plugins />, { wrapper: MemoryRouterWrapper });

    expect(await screen.findByText("I'm Not AI")).toBeInTheDocument();
    expect(screen.queryByText("Claude Code")).not.toBeInTheDocument();
    expect(screen.getAllByText("Claude Code에 설치돼요").length).toBe(2);
    expect(screen.getByText("Claude Code 필요")).toBeInTheDocument();
  });
});
