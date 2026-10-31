/**
 * 어휘 — prop 이 받는 닫힌 값의 집합입니다. 축마다 상수 하나와 타입 하나가 짝입니다.
 *
 * 컴포넌트 · 스타일시트 · Playground 의 선택지가 모두 이 배열에서 나옵니다. 축에 값을
 * 더하면 여기 한 곳만 고치면 되고, 빠진 자리는 타입이 막습니다.
 */

/** Accent — 색 이름. `black` 이 시스템 기본입니다 */
export const ACCENTS = ["black", "pink", "purple", "cyan", "yellow", "orange", "sky", "green", "red", "success", "error", "warning", "info"] as const;
export type AccentName = (typeof ACCENTS)[number];

/** Accent 역할 별칭 — 색에 뜻을 붙여 부를 때. 별칭은 색으로 풀립니다 */
export const ACCENT_ROLES = {
  system: "black",
  primary: "pink",
  secondary: "purple",
} as const satisfies Record<string, AccentName>;
export type AccentRole = keyof typeof ACCENT_ROLES;

export type Accent = AccentName | AccentRole;

export function resolveAccent(accent: Accent): AccentName {
  return accent in ACCENT_ROLES ? ACCENT_ROLES[accent as AccentRole] : (accent as AccentName);
}

/** Variant — 같은 accent 를 얼마나 진하게, 어디에 칠하는가 (규칙은 `color-recipes.ts`) */
export const VARIANTS = [
  "filled",
  "outline",
  "hairline",
  "frameline",
  "framelineMuted",
  "plain",
  "solid",
  "solidMuted",
  "muted",
  "ghost",
  "ghostMuted",
  "paper",
  "tinted",
  "wash",
  "ghostTint",
] as const;
export type Variant = (typeof VARIANTS)[number];

/** 누르는 컨트롤의 크기 — Button · IconButton · Input · Select · SegmentedControl */
export const CONTROL_SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
export type ControlSize = (typeof CONTROL_SIZES)[number];

/** 읽는 라벨의 크기 — Badge */
export const BADGE_SIZES = ["sm", "md", "lg", "xl"] as const;
export type BadgeSize = (typeof BADGE_SIZES)[number];

/**
 * 면 — `Surface` 가 칠하는 박스의 면. 흑백 다섯에 구조 면 하나(`brand` — 상단 바 · 하단 바의 보라)입니다.
 * accent 로 칠하는 면은 여기 없고 `Paint` 의 variant 입니다 (박스는 자리의 색, 요소는 accent — 두 primitive 가
 * 나눠 맡습니다). `none` 은 면 없이 바깥 면을 그대로 보입니다 — 목록 줄 · 아코디언 머리처럼 면 위의 한 칸에 씁니다.
 */
export const SURFACE_FILLS = ["none", "canvas", "raised", "sunken", "well", "inverse", "brand"] as const;
export type SurfaceFill = (typeof SURFACE_FILLS)[number];

/** 테두리 — 2px 한 굵기. 흑백 선의 색만 고릅니다 (accent 테두리는 Paint 의 variant) */
export const BORDERS = ["none", "line", "soft", "subtle"] as const;
export type Border = (typeof BORDERS)[number];

/** 테두리를 긋는 변 — 기본 `all`. 칸을 나누는 왼쪽 선 · 위아래 선에 씁니다 */
export const BORDER_SIDES = ["all", "left", "right", "top", "bottom", "x", "y"] as const;
export type BorderSide = (typeof BORDER_SIDES)[number];

/** 테두리의 선 — `dashed` 는 비어 있는 자리 · 넣을 수 있는 자리 */
export const BORDER_STYLES = ["solid", "dashed"] as const;
export type BorderStyle = (typeof BORDER_STYLES)[number];

/** 그림자 — 떠 있는 물건(raised)과 모달(floating) 두 단뿐입니다 */
export const SHADOWS = ["none", "raised", "floating"] as const;
export type Shadow = (typeof SHADOWS)[number];

/** 간격 — 안쪽 여백과 형제 사이가 같은 사다리를 씁니다 */
export const SPACES = ["0", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"] as const;
export type Space = (typeof SPACES)[number];

/** 글자 역할 */
export const TEXT_VARIANTS = [
  "hero",
  "display",
  "headline",
  "title",
  "heading",
  "subheading",
  "body",
  "small",
  "caption",
  "label",
  "micro",
  "overline",
  "eyebrow",
  "subtitle",
] as const;
export type TextVariant = (typeof TEXT_VARIANTS)[number];

/** 글자 굵기 — 역할의 기본값을 바꿀 때만 */
export const WEIGHTS = ["regular", "medium", "bold", "black"] as const;
export type Weight = (typeof WEIGHTS)[number];

/** 줄 높이 — `fixed` 는 역할이 정한 px, `relaxed` 는 여러 줄 문단을 읽는 자리 */
export const LEADINGS = ["fixed", "relaxed"] as const;
export type Leading = (typeof LEADINGS)[number];

/** 글자에 긋는 선 */
export const TEXT_DECORATIONS = ["strike", "underline"] as const;
export type TextDecoration = (typeof TEXT_DECORATIONS)[number];

/**
 * 글자 색 — 흑백 잉크, 지금 accent 의 두 글자 칸, 그리고 색 이름 여덟입니다. 색 이름은 그 accent 의 진한 글자이고,
 * 글자 하나만 칠합니다 — accent 를 다시 쓰지 않으므로 안쪽으로 흐르지 않습니다 (검정은 `primary`)
 */
export const TONES = [
  "primary",
  "secondary",
  "muted",
  "faint",
  "inverse",
  "inverseMuted",
  "accent",
  "accentSoft",
  "inherit",
  "pink",
  "purple",
  "cyan",
  "yellow",
  "orange",
  "sky",
  "green",
  "red",
  "success",
  "error",
  "warning",
  "info",
] as const;
export type Tone = (typeof TONES)[number];

export const FAMILIES = ["sans", "mono"] as const;
export type Family = (typeof FAMILIES)[number];

/** 정렬 — Stack · Inline · Grid 가 같이 씁니다 */
export const ALIGNS = ["start", "center", "end", "stretch", "baseline"] as const;
export type Align = (typeof ALIGNS)[number];
export const JUSTIFIES = ["start", "center", "end", "between", "around"] as const;
export type Justify = (typeof JUSTIFIES)[number];

/** 아이콘 크기 */
export const ICON_SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
export type IconSize = (typeof ICON_SIZES)[number];

/** 바깥 버튼 · 링크에 마우스를 올리면 아이콘만 움직입니다 — 돌거나(`turn`) 옆으로 밀립니다(`nudge`) */
export const ICON_MOTIONS = ["turn", "nudge"] as const;
export type IconMotion = (typeof ICON_MOTIONS)[number];

/**
 * 누르는 몸짓 (Pressable) — 움직이지 않거나(none, 기본), 그림자 속으로 가라앉거나(sink), 평평하다가 그림자가
 * 올라오거나(raise), 위로 떠오르거나(lift), 그림자 없이 누르는 순간만 작아지거나(tap), 그림자를 둔 채 hover 때부터 작아지거나(shrink),
 * 그림자를 둔 채 움직이지 않습니다(still — 밖에서 켠 상태라 hover 와 상관없는 칸).
 * 버튼은 그림자를 켜면 sink, `shadow="hover"` 면 raise, `shadow="shrink"` 면 shrink, `shadow="static"` 면 still, 끄면 tap 입니다.
 */
export const MOTIONS = ["none", "sink", "raise", "lift", "tap", "shrink", "still"] as const;
export type PressMotion = (typeof MOTIONS)[number];

/** 링크의 밑줄 — `always` 는 글 속 링크, `hover` 는 hover 때만 밑줄이 생기는 조용한 링크 */
export const LINK_UNDERLINES = ["always", "hover"] as const;
export type LinkUnderline = (typeof LINK_UNDERLINES)[number];

/** 분류 표시의 모양 — 네모 점(분류) · 둥근 점(상태) · 왼쪽 띠 */
export const SWATCH_SHAPES = ["dot", "round", "rail"] as const;
export type SwatchShape = (typeof SWATCH_SHAPES)[number];

/** 분류 표시의 칠 — accent 사다리의 어느 칸인가. 검정의 두 칸(`softInk` · `soft`)이 회색 분류입니다 */
export const SWATCH_RUNGS = ["solid", "softInk", "soft"] as const;
export type SwatchRung = (typeof SWATCH_RUNGS)[number];

/** 로고 글자의 크기 */
export const WORDMARK_SIZES = ["sm", "md", "lg"] as const;
export type WordmarkSize = (typeof WORDMARK_SIZES)[number];

/** 접는 카드의 제목 — `heading` 은 20px 문장, `section` 은 대문자 섹션 제목 (좁은 화면 14px → 넓은 화면 20px) */
export const ACCORDION_TITLES = ["heading", "section"] as const;
export type AccordionTitle = (typeof ACCORDION_TITLES)[number];

/** 등장 몸짓 — 새로 나타나는 판이 떠오르거나(rise · pop) 제자리에서 나타납니다(fade). 거리 · 시간은 `ENTER` */
export const ENTER_MOTIONS = ["none", "rise", "pop", "fade", "panel", "sheet"] as const;
export type EnterMotion = (typeof ENTER_MOTIONS)[number];

/** 안내 상자의 칠 — `plain` 은 연한 면, `solid` 는 꽉 찬 색 띠 */
export const NOTICE_VARIANTS = ["plain", "solid"] as const;
export type NoticeVariant = (typeof NOTICE_VARIANTS)[number];

/** 접는 카드의 크기 — `sm` 은 12px 제목의 촘촘한 줄 */
export const ACCORDION_SIZES = ["lg", "md", "sm"] as const;
export type AccordionSize = (typeof ACCORDION_SIZES)[number];

/** 떠 있는 판을 여는 법 — 마우스를 올리면 · 누르면 · 부르는 쪽이 `open` 으로 */
export const POPOVER_TRIGGERS = ["hover", "click", "manual"] as const;
export type PopoverTrigger = (typeof POPOVER_TRIGGERS)[number];

/** 표 머리의 칠 */
export const TABLE_HEADS = ["inverse", "well", "plain"] as const;
export type TableHead = (typeof TABLE_HEADS)[number];

/** 서랍이 붙는 가장자리 */
export const DRAWER_SIDES = ["right", "left", "bottom"] as const;
export type DrawerSide = (typeof DRAWER_SIDES)[number];
