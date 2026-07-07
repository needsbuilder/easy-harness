import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUpdatePhase } from "../../lib/appUpdate";

const { mockUseAppUpdateContext } = vi.hoisted(() => ({
  mockUseAppUpdateContext: vi.fn(),
}));
vi.mock("../../lib/appUpdateContext", () => ({
  useAppUpdateContext: mockUseAppUpdateContext,
}));

import { UpdateBanner } from "../UpdateBanner";

function setPhase(phase: AppUpdatePhase) {
  mockUseAppUpdateContext.mockReturnValue({ phase, install: vi.fn() });
}

beforeEach(() => {
  setPhase({ kind: "idle" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("UpdateBanner", () => {
  it("idle 상태면 아무것도 그리지 않는다", () => {
    setPhase({ kind: "idle" });
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("업데이트가 있으면 배너와 버튼을 보여준다", () => {
    setPhase({ kind: "available" });
    render(<UpdateBanner />);
    expect(screen.getByText(/새 버전이 나왔어요/)).toBeInTheDocument();
    expect(screen.getByText("지금 업데이트")).toBeInTheDocument();
  });

  it("진행률을 알면 퍼센트를 보여준다", () => {
    setPhase({ kind: "downloading", percent: 42 });
    render(<UpdateBanner />);
    expect(screen.getByText(/받는 중이에요 42%/)).toBeInTheDocument();
  });

  it("진행률을 모르면(null) 퍼센트 없이 받는 중 문구만 보여준다", () => {
    setPhase({ kind: "downloading", percent: null });
    render(<UpdateBanner />);
    expect(screen.getByText("새 버전을 받는 중이에요")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("실패하면 실패 안내를 보여준다", () => {
    setPhase({ kind: "failed" });
    render(<UpdateBanner />);
    expect(screen.getByText(/받지 못했어요/)).toBeInTheDocument();
  });
});
