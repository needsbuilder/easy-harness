import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardStepper } from "../WizardStepper";
import { ErrorPanel } from "../ErrorPanel";

describe("마법사 부품", () => {
  it("스텝퍼는 4단계와 현재 단계를 표시한다", () => {
    render(<WizardStepper current={2} toolName="모의 도구" />);
    for (const label of ["컴퓨터 점검", "준비물 설치", "모의 도구 설치", "마무리"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("준비물 설치").className).toContain("font-bold");
  });

  it("에러 패널은 다시 시도 버튼을 부른다", () => {
    const onRetry = vi.fn();
    render(
      <ErrorPanel
        message="이 단계가 잘 끝나지 않았어요. 다시 시도해 볼까요?"
        friendly="지금 모의 도구를 설치하고 있어요"
        onRetry={onRetry}
        onCopyLog={() => {}}
      />,
    );
    screen.getByRole("button", { name: "다시 시도" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
