import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { MemoryRouter } from "react-router";
import { Catalog } from "../Catalog";

describe("Catalog", () => {
  afterEach(() => clearMocks());

  it("catalog://updated 이벤트를 받으면 목록을 다시 불러온다", async () => {
    let listCatalogCalls = 0;
    mockIPC(
      (cmd) => {
        if (cmd === "list_catalog") {
          listCatalogCalls += 1;
          return [];
        }
      },
      { shouldMockEvents: true },
    );

    render(
      <MemoryRouter>
        <Catalog />
      </MemoryRouter>,
    );

    await waitFor(() => expect(listCatalogCalls).toBe(1));

    await emit("catalog://updated");

    await waitFor(() => expect(listCatalogCalls).toBe(2));
  });
});
