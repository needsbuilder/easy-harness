import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { Settings } from "../Settings";

describe("설정 화면", () => {
  afterEach(() => clearMocks());

  it("진단 파일을 저장하고 결과 안내를 보여준다", async () => {
    mockIPC((cmd) => {
      if (cmd === "export_diagnostics") return "/Users/me/Downloads/easy-harness-diagnostics-1.zip";
    });
    render(<Settings />);
    screen.getByRole("button", { name: "진단 파일 저장하기" }).click();
    expect(await screen.findByText(/다운로드 폴더에 저장했어요/)).toBeInTheDocument();
  });
});
