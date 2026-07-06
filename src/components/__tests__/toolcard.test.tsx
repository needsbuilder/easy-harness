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
  it("이름·설명·배지를 그린다", () => {
    render(<ToolCard entry={entry} onSelect={() => {}} />);
    expect(screen.getByText("모의 도구")).toBeInTheDocument();
    expect(screen.getByText("입문자 추천")).toBeInTheDocument();
    expect(screen.getByText("Claude 모델")).toBeInTheDocument();
    expect(screen.getByText("Anthropic 계정")).toBeInTheDocument();
    expect(screen.getByText("무료")).toBeInTheDocument();
  });

  it("설치된 카드는 버전 캡션을 보여준다", () => {
    render(<ToolCard entry={{ ...entry, installed: true, installedVersion: "1.2.3" }} onSelect={() => {}} />);
    expect(screen.getByText(/설치됨/)).toHaveTextContent("설치됨 · v1.2.3");
  });

  it("선행 도구가 빠졌으면 경고 배지를 보여준다", () => {
    render(<ToolCard entry={{ ...entry, missingRequires: ["codex"] }} onSelect={() => {}} />);
    expect(screen.getByText("codex 필요")).toBeInTheDocument();
  });

  it("source가 있으면 제작자 표기를 보여준다", () => {
    render(<ToolCard entry={{ ...entry, source: { label: "만든 곳: NomaDamas" } }} onSelect={() => {}} />);
    expect(screen.getByText("만든 곳: NomaDamas")).toBeInTheDocument();
  });

  it("클릭하면 onSelect에 id를 넘긴다", () => {
    const onSelect = vi.fn();
    render(<ToolCard entry={entry} onSelect={onSelect} />);
    screen.getByRole("button", { name: /모의 도구/ }).click();
    expect(onSelect).toHaveBeenCalledWith("mock-tool");
  });

  it("available=false면 클릭이 막히고 맥 전용 안내가 보인다", () => {
    const onSelect = vi.fn();
    render(<ToolCard entry={{ ...entry, available: false, platforms: ["mac"] }} onSelect={onSelect} />);
    expect(screen.getByText("지금은 맥에서만 설치돼요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
