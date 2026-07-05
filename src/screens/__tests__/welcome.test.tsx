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

  it("진단 실패 시 안내와 다시 점검 버튼을 보여준다", async () => {
    let calls = 0;
    mockIPC((cmd) => {
      if (cmd === "get_env_report") {
        calls += 1;
        if (calls === 1) throw new Error("ipc down");
        return { os: "mac", osLabel: "맥", arch: "aarch64", checks: [], missingCount: 0 };
      }
    });
    render(<MemoryRouter><Welcome /></MemoryRouter>);
    expect(await screen.findByText(/점검이 잠깐 안 됐어요/)).toBeInTheDocument();
    screen.getByRole("button", { name: "다시 점검하기" }).click();
    expect(await screen.findByText(/준비물도 모두 갖춰져 있어요/)).toBeInTheDocument();
  });
});
