/** class 이름을 잇습니다 — 거짓 값은 건너뜁니다 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
