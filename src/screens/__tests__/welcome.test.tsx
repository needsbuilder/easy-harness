import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { MemoryRouter } from "react-router";
import { Welcome } from "../Welcome";

describe("환영 화면", () => {
  afterEach(() => clearMocks());

  it("진단 결과를 쉬운 말로 보여준다", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_env_report") {
        return {
          os: "mac", osLabel: "맥", arch: "aarch64",
          checks: [
            { id: "node", label: "Node.js 준비물", found: true, version: "v24.16.0" },
            { id: "git", label: "git 준비물", found: false, version: null },
          ],
          missingCount: 1,
        };
      }
    });
    render(<MemoryRouter><Welcome /></MemoryRouter>);
    expect(await screen.findByText(/준비물 1개가 필요해요/)).toBeInTheDocument();
    expect(screen.getByText(/맥에서 사용할 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "도구 고르러 가기" })).toBeInTheDocument();
  });
});
