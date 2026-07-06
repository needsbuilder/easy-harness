import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { Success } from "../Success";

function renderAt(entry: { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/success/:toolId" element={<Success />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Success", () => {
  afterEach(cleanup);

  it("내부 id가 아니라 전달받은 도구 이름을 보여준다", () => {
    renderAt({ pathname: "/success/gajaecode", state: { name: "가재코드" } });
    expect(screen.getByText("가재코드 준비 완료!")).toBeInTheDocument();
  });

  it("이름이 전달되지 않으면 id로 폴백한다", () => {
    renderAt({ pathname: "/success/gajaecode" });
    expect(screen.getByText("gajaecode 준비 완료!")).toBeInTheDocument();
  });

  it("함께 설치한 도구가 있으면 같이 보여준다", () => {
    renderAt({ pathname: "/success/lazycodex", state: { name: "lazycodex", helpers: ["Codex", "Node.js"] } });
    expect(screen.getByText(/Codex·Node.js도 함께 준비했어요/)).toBeInTheDocument();
  });
});
