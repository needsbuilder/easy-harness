import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { ToolCard } from "../ToolCard";
import type { CatalogEntry } from "../../lib/types";

const entry: CatalogEntry = {
  id: "mock-tool", name: "모의 도구", kind: "harness",
  easyDescription: "설치 흐름을 시험하는 가짜 도구예요",
  pricing: { label: "무료", kind: "free" },
  supportedModels: [{ modelLabel: "Claude 모델", accountLabel: "Anthropic 계정" }],
  recommended: true, requires: [], installed: false, installedVersion: null,
  missingRequires: [], platforms: ["mac", "windows"], available: true,
};

describe("ToolCard", () => {
  afterEach(() => cleanup());

  it("아이콘·이름·설명만 그리고 잡다한 배지는 없앤다", () => {
    render(<ToolCard entry={entry} onSelect={() => {}} />);
    expect(screen.getByText("모의 도구")).toBeInTheDocument();
    expect(screen.getByText("설치 흐름을 시험하는 가짜 도구예요")).toBeInTheDocument();
    // 정리한 배지·가격·모델 표기는 더 이상 카드에 없다
    expect(screen.queryByText("입문자 추천")).not.toBeInTheDocument();
    expect(screen.queryByText("무료")).not.toBeInTheDocument();
    expect(screen.queryByText("Claude 모델")).not.toBeInTheDocument();
    expect(screen.queryByText(/설치됨/)).not.toBeInTheDocument();
  });

  it("플러그인은 어느 하네스에 붙는지 한 줄로 보여준다", () => {
    render(
      <ToolCard
        entry={{ ...entry, kind: "plugin", requires: ["codex"] }}
        onSelect={() => {}}
        resolveName={(id) => (id === "codex" ? "Codex" : id)}
      />,
    );
    expect(screen.getByText("Codex에 설치돼요")).toBeInTheDocument();
  });

  it("클릭하면 onSelect에 id를 넘긴다", () => {
    const onSelect = vi.fn();
    render(<ToolCard entry={entry} onSelect={onSelect} />);
    screen.getByRole("button", { name: /모의 도구/ }).click();
    expect(onSelect).toHaveBeenCalledWith("mock-tool");
  });

  it("available=false면 클릭이 막힌다", () => {
    const onSelect = vi.fn();
    render(<ToolCard entry={{ ...entry, available: false, platforms: ["mac"] }} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
