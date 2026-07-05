import "@testing-library/jest-dom/vitest";
import { randomFillSync } from "node:crypto";

Object.defineProperty(window, "crypto", {
  value: { getRandomValues: (buffer: ArrayBufferView) => randomFillSync(buffer as never) },
});
