import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SecretForm } from "../SecretForm";

describe("SecretForm", () => {
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
});
