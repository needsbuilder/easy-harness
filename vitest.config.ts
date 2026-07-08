import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // 앱(src/)만 테스트한다. web/(랜딩)·video/(Remotion)는 각자 설정으로 돌린다.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
