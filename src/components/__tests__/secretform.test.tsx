import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SecretForm } from "../SecretForm";

describe("SecretForm", () => {
  afterEach(() => cleanup());

  it("마스킹 입력을 받아 제출하고, 빈 값은 막는다", () => {
    const onSubmit = vi.fn();
    render(<SecretForm label="api_key" onSubmit={onSubmit} />);
    const input = screen.getByLabelText<HTMLInputElement>(/열쇠 값/);
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "sk-live-1" } });
    fireEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(onSubmit).toHaveBeenCalledWith("sk-live-1");
  });

  it("error가 있으면 안내를 role=alert로 보여준다", () => {
    render(<SecretForm label="api_key" onSubmit={vi.fn()} error="쓸 수 없는 문자가 섞여 있어요" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/쓸 수 없는 문자/);
    // 에러가 없으면 안내도 없다
    cleanup();
    render(<SecretForm label="api_key" onSubmit={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("제출하면 입력이 비워지고, submitting이면 버튼이 잠긴다", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<SecretForm label="api_key" onSubmit={onSubmit} />);
    const input = screen.getByLabelText("열쇠 값 붙여넣기") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "oc-123" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("oc-123");
    expect(input.value).toBe("");
    rerender(<SecretForm label="api_key" onSubmit={onSubmit} submitting />);
    expect(screen.getByRole("button", { name: "확인하는 중" })).toBeDisabled();
  });
});
