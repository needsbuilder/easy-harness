import { staticFile, continueRender, delayRender } from "remotion";

// 렌더용 헤드리스 크롬엔 한글 폰트가 없어 텍스트가 깨진다. Pretendard를 직접 로드해 심는다.
const handle = delayRender("Loading Pretendard");
const font = new FontFace(
  "PretendardVariable",
  `url(${staticFile("pretendard.woff2")}) format("woff2")`,
);
font
  .load()
  .then(() => {
    document.fonts.add(font);
    continueRender(handle);
  })
  .catch(() => continueRender(handle));
