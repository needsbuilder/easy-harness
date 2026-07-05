import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { PrimaryButton } from "../Buttons";
import { Badge } from "../Badge";
import { AppShell } from "../AppShell";
import { AuthGuidePanel } from "../AuthGuidePanel";

describe("UI 킷", () => {
  it("주 버튼은 골드 그라디언트와 클릭 핸들러를 가진다", () => {
    const onClick = vi.fn();
    render(<PrimaryButton onClick={onClick}>도구 고르러 가기</PrimaryButton>);
    const btn = screen.getByRole("button", { name: "도구 고르러 가기" });
    expect(btn.className).toContain("bg-gold-gradient");
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("배지는 변형별 스타일 클래스를 가진다", () => {
    render(<Badge variant="recommended">입문자 추천</Badge>);
    expect(screen.getByText("입문자 추천").className).toContain("bg-gold-gradient");
  });

  it("안내 카드는 기본 3열, stacked면 좁은 자리용 1열로 쌓인다", () => {
    const guide = ["하나", "둘", "셋"];
    const { container, rerender } = render(<AuthGuidePanel guide={guide} />);
    expect(container.firstElementChild?.className).toContain("md:grid-cols-3");
    // 터미널 옆 좁은 칸에서는 3열이 글자를 세로로 부숴버리므로 1열로 쌓아야 한다.
    rerender(<AuthGuidePanel guide={guide} stacked />);
    expect(container.firstElementChild?.className).not.toContain("md:grid-cols-3");
  });

  it("AppShell 사이드바에 메뉴 5개가 있다", () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );
    for (const label of ["홈", "하네스", "플러그인 · 오픈소스", "내 도구", "설정"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
