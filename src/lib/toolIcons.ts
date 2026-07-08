// 도구 id → 공식 아이콘 URL. src/assets/tool-icons/<id>.png 를 Vite glob으로 모은다.
// 공식 로고가 있는 도구만 파일이 있고, 없는 도구(예: korean-law-mcp)는 여기 없어서
// undefined가 되며 ToolCard가 이름 첫 글자 타일로 폴백한다.
const modules = import.meta.glob("../assets/tool-icons/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const iconById: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const id = path.split("/").pop()!.replace(/\.png$/, "");
  iconById[id] = url as string;
}

/** 도구 id의 공식 아이콘 URL. 없으면 undefined(첫 글자 폴백용). */
export function toolIconFor(id: string): string | undefined {
  return iconById[id];
}
