import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SITE_URL } from "./links";

/** 경로를 정식 주소로 붙여 준다. 홈은 슬래시 하나로 끝낸다. */
export function canonicalUrl(pathname: string): string {
  if (pathname === "/" || pathname === "") return `${SITE_URL}/`;
  // 끝 슬래시는 떼서 /terms 와 /terms/ 가 다른 주소로 잡히지 않게 한다
  const clean = pathname.replace(/\/+$/, "");
  return `${SITE_URL}${clean}`;
}

/**
 * 페이지를 옮길 때마다 <link rel="canonical"> 과 og:url 을 지금 경로에 맞춰 준다.
 * index.html 에 박아 둔 값은 홈 기준이라, 이게 없으면 /terms 에서도 홈 주소를 가리킨다.
 */
export function useCanonical(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const url = canonicalUrl(pathname);

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = url;

    document
      .querySelector<HTMLMetaElement>('meta[property="og:url"]')
      ?.setAttribute("content", url);
  }, [pathname]);
}
