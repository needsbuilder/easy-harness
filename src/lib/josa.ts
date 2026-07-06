/** 이름 끝 글자의 받침 유무로 은/는 조사를 고른다. 한글 아닌 끝 글자(영문 등)는 "는"으로 둔다. */
export function eunNeun(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return "는";
  return (last - 0xac00) % 28 === 0 ? "는" : "은";
}
