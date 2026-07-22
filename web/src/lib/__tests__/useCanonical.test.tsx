import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { canonicalUrl, useCanonical } from "../useCanonical";

function Probe() {
  useCanonical();
  return null;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>,
  );
}

const canonicalHref = () =>
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

beforeEach(() => {
  document.head.innerHTML = "";
});

describe("canonicalUrl", () => {
  it("홈은 슬래시 하나로 끝난다", () => {
    expect(canonicalUrl("/")).toBe("https://easyharness.needslab.ai/");
  });

  it("하위 경로를 정식 주소에 붙인다", () => {
    expect(canonicalUrl("/terms")).toBe(
      "https://easyharness.needslab.ai/terms",
    );
  });

  it("끝 슬래시를 떼서 같은 주소로 모은다", () => {
    expect(canonicalUrl("/privacy/")).toBe(canonicalUrl("/privacy"));
  });
});

describe("useCanonical", () => {
  it("canonical 링크가 없으면 만들어 넣는다", () => {
    renderAt("/terms");
    expect(canonicalHref()).toBe("https://easyharness.needslab.ai/terms");
  });

  it("이미 있는 canonical 링크는 새로 만들지 않고 값만 바꾼다", () => {
    const existing = document.createElement("link");
    existing.rel = "canonical";
    existing.href = "https://easyharness.needslab.ai/";
    document.head.appendChild(existing);

    renderAt("/privacy");

    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(canonicalHref()).toBe("https://easyharness.needslab.ai/privacy");
  });

  it("og:url 도 같은 주소로 맞춘다", () => {
    const og = document.createElement("meta");
    og.setAttribute("property", "og:url");
    og.setAttribute("content", "https://easyharness.needslab.ai/");
    document.head.appendChild(og);

    renderAt("/terms");

    expect(og.getAttribute("content")).toBe(
      "https://easyharness.needslab.ai/terms",
    );
  });
});
