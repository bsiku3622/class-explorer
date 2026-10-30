/**
 * Cascade layer — 패키지 CSS 는 전부 `fk` 레이어 안에 듭니다.
 *
 *   fk.reset < fk.theme < fk.base < fk.primitives < fk.components < fk.utilities
 *
 * 뒤의 레이어가 특정도와 무관하게 이깁니다. 층 구조를 그대로 옮긴 순서라, 위 층(atom · molecule ·
 * component)의 CSS 는 primitive 의 칠(Surface · Paint · Glass)을 언제나 덮을 수 있습니다 — 모달 머리 막대가
 * Paint 의 filled 를 쓰되 테두리를 아래쪽만 남기는 식입니다. 여백 · 글자 같은 prop class(utilities)는
 * 그 위에 섭니다.
 *
 * 앱 CSS 는 레이어 밖(또는 `fk` 뒤의 레이어)에 두면 로드 순서와 무관하게 패키지를 이깁니다. Tailwind v4 와
 * 함께 쓸 때는 앱 CSS 맨 위에 `@layer theme, base, fk, components, utilities;` 를 먼저 선언합니다. fk 가 base 앞에 서면 preflight 가 funky 의 여백 · 테두리를 지웁니다.
 */
import { globalLayer } from "@vanilla-extract/css";

export const fk = globalLayer("fk");
export const reset = globalLayer({ parent: fk }, "reset");
export const theme = globalLayer({ parent: fk }, "theme");
export const base = globalLayer({ parent: fk }, "base");
export const primitives = globalLayer({ parent: fk }, "primitives");
export const components = globalLayer({ parent: fk }, "components");
export const utilities = globalLayer({ parent: fk }, "utilities");
