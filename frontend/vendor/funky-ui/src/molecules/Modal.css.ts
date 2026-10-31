import { globalStyle, style, styleVariants } from "@vanilla-extract/css";

import { ENTER_ANIMATION, enterKeyframes } from "../styles/enter.css";
import { components } from "../tokens/layers.css";
import { CONTAINER, SPACE } from "../tokens/layout";
import { CONTROL_TEXT, TEXT_ROLES, WEIGHT, em, px } from "../tokens/typography";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const modal = style(
  c({
    // ⚠️ 가운데 정렬은 브라우저 기본의 `margin: auto` 입니다 — Tailwind preflight 의 `margin: 0` 이 지우므로 직접 적습니다
    margin: "auto",
    padding: 0,
    width: `calc(100% - ${px(SPACE["4xl"])})`,
    maxHeight: "90vh",
    overflowY: "auto",
    color: vars.ink.primary,
    borderRadius: 0,
    selectors: {
      // 등장은 다른 판과 같은 몸짓(pop)이고, 뒤 막은 판과 같은 시간에 제자리에서 나타납니다
      "&[open]": { animation: ENTER_ANIMATION.pop },
      "&::backdrop": { backgroundColor: vars.overlay.scrim, animation: `${enterKeyframes.fade} ${vars.duration.base} ${vars.easing.out}` },
    },
  }),
);

/** 모달이 열려 있는 동안 뒤 화면이 스크롤되지 않습니다 */
globalStyle(`html:has(${modal}[open])`, c({ overflow: "hidden" }));

export const modalSize = styleVariants(CONTAINER.dialog, (w) => c({ maxWidth: px(w) }));

/** 넓은 모달 — 머리가 고정되고 본문이 남은 높이를 채웁니다 (자료 미리보기) */
export const modalFull = style(c({ height: "96vh", maxHeight: "96vh", overflow: "hidden" }));
export const modalContentFill = style(c({ display: "flex", flexDirection: "column", height: "100%" }));
export const modalBodyFill = style(c({ flex: 1, minHeight: 0, overflow: "auto" }));
export const modalBodyFlush = style(c({ padding: 0 }));

export const modalHeader = style(
  c({
    position: "sticky",
    top: 0,
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: px(SPACE.lg),
    paddingInline: px(SPACE["2xl"]),
    paddingBlock: px(SPACE.lg),
    // 칠은 Paint(filled)가 하고, 테두리는 아래 한 줄만 남깁니다
    borderWidth: `0 0 ${vars.stroke.base}`,
    borderColor: vars.line.base,
  }),
);

export const modalTitle = style(
  c({
    fontSize: px(CONTROL_TEXT.md.size),
    fontWeight: WEIGHT.black,
    letterSpacing: em(0.1),
    textTransform: "uppercase",
    minWidth: 0,
  }),
);

export const modalTitlePlain = style(c({ textTransform: "none", letterSpacing: 0 }));
export const modalHeadText = style(c({ display: "flex", flexDirection: "column", gap: px(SPACE["2xs"]), flex: 1, minWidth: 0 }));
export const modalSubtitle = style(
  c({
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
    fontSize: px(TEXT_ROLES.caption.size),
    lineHeight: px(TEXT_ROLES.caption.leading),
    fontWeight: WEIGHT.bold,
    opacity: 0.8,
  }),
);
export const modalHeadActions = style(c({ display: "flex", alignItems: "center", gap: px(SPACE.md), flexShrink: 0 }));

/** 막대 위 닫기 — 막대 글자색을 따르고, 쉴 때는 한 단 옅습니다 */
export const modalClose = style(
  c({
    display: "inline-flex",
    padding: px(SPACE.xs),
    margin: `calc(-1 * ${px(SPACE.xs)})`,
    border: 0,
    background: "none",
    color: "inherit",
    opacity: 0.7,
    cursor: "pointer",
    transitionProperty: "opacity",
    transitionDuration: vars.duration.fast,
    selectors: { "&:hover": { opacity: 1 } },
  }),
);

export const modalContent = style(c({ position: "relative" }));

/** 머리 막대가 없을 때 — 흰 면 오른쪽 위에 앉고 본문 잉크를 따릅니다 */
export const modalCloseCorner = style(
  c({
    position: "absolute",
    top: px(SPACE.lg),
    right: px(SPACE.lg),
    margin: 0,
    zIndex: 1,
    color: vars.ink.primary,
  }),
);

export const modalBody = style(c({ padding: px(SPACE["2xl"]) }));

export const modalFooter = style(
  c({
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: px(SPACE.md),
    paddingInline: px(SPACE["2xl"]),
    paddingBlock: px(SPACE.xl),
    borderTop: `${vars.stroke.base} solid ${vars.line.subtle}`,
  }),
);

/** 색 띠 푸터 — 칠은 Paint 가 하고, 테두리는 위 한 줄만 남깁니다 */
export const modalFooterStrip = style(c({ borderWidth: `${vars.stroke.base} 0 0`, borderColor: vars.line.base }));
