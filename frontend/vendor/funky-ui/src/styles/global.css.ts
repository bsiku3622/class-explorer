/**
 * 전역 스타일시트 — entry `@studio-baeks/funky-ui/styles.css`.
 *
 * 레이어 선언 → 변수(:root) → reset → 문서 바탕 · 글자 · 포커스 링 · reduced motion 순서입니다.
 */
import { globalKeyframes, globalStyle } from "@vanilla-extract/css";

import "../tokens/layers.css";
import "../tokens/theme.css";
import { base, reset } from "../tokens/layers.css";
import { TEXT_ROLES } from "../tokens/typography";
import { textRule } from "../tokens/typography-recipes";
import { vars } from "../tokens/variables";

const r = (rule: Record<string, unknown>) => ({ "@layer": { [reset]: rule } });
const b = (rule: Record<string, unknown>) => ({ "@layer": { [base]: rule } });

globalStyle("*, *::before, *::after", r({ boxSizing: "border-box" }));
globalStyle("body", r({ margin: 0 }));
globalStyle("button, input, select, textarea", r({ font: "inherit", color: "inherit", letterSpacing: "inherit" }));

/** 본문 — body 역할 전체를 받아 Text 밖의 글자도 같은 글자로 그려집니다 */
globalStyle(
  "body",
  b({
    ...textRule(TEXT_ROLES.body),
    backgroundColor: vars.surface.canvas,
    color: vars.ink.primary,
    fontFamily: vars.font.sans,
    wordBreak: "keep-all",
    overflowWrap: "break-word",
    WebkitFontSmoothing: "antialiased",
  }),
);

/**
 * 포커스 링 — 2px 를 2px 띄운 핑크 고리. Tab 으로 왔을 때만 보입니다. 글자 칸은 마우스로 눌러도 `:focus-visible` 이라서
 * 마지막 입력이 Tab 이 아니면(`internal/focusModality`) 두께를 0 으로 둡니다. 링을 그리는 자리(토글 · FileDrop · 시간표 칸)가
 * 모두 이 변수를 읽으므로 여기 한 곳에서 꺼집니다.
 */
globalStyle(
  ":where(:focus-visible)",
  b({
    outline: `${vars.focusRing.width} solid ${vars.focus}`,
    outlineOffset: vars.focusRing.offset,
  }),
);
globalStyle(':root[data-fk-focus="pointer"]', b({ vars: { [vars.focusRing.width]: "0px" } }));

globalStyle("::selection", b({ backgroundColor: vars.selection, color: vars.ink.primary }));

/** 움직임을 줄인 사람에게는 이동을 멈추고 색과 포커스 링만 남깁니다 */
globalStyle(
  "*, *::before, *::after",
  b({
    "@media": {
      "(prefers-reduced-motion: reduce)": {
        animationDuration: "0.01ms !important",
        animationIterationCount: "1 !important",
        transitionDuration: "0.01ms !important",
        scrollBehavior: "auto !important",
      },
    },
  }),
);

/** 스피너 — 이름이 고정이라 앱도 같은 회전을 씁니다 */
globalKeyframes("fk-spin", { to: { transform: "rotate(360deg)" } });
