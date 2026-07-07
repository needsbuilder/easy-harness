import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * Tauri 이벤트 구독 훅. listen()은 비동기라 resolve되기 전에 컴포넌트가 언마운트되면
 * unlisten 함수를 받지 못해 리스너가 새는 경쟁이 생긴다. cancelled 플래그로 그 사이를 막는다.
 * (참고: src/lib/appUpdate.ts의 동일 패턴)
 *
 * handler는 ref로 잡아두므로 event 이름이 바뀔 때만 재구독한다(매 렌더마다 재구독하지 않음).
 */
export function useTauriEvent<T = void>(event: string, handler: (payload: T) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listen<T>(event, (e) => handlerRef.current(e.payload)).then((un) => {
      if (cancelled) {
        un();
      } else {
        unlisten = un;
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [event]);
}
