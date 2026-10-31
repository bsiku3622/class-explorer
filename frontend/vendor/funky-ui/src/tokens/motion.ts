/**
 * Motion — 시간 · 곡선 · 누름의 거리.
 *
 * 시그니처는 **눌림**입니다: 떠 있는 물건이 hover 때 그림자 자리로 가라앉습니다. 가라앉는
 * 거리는 그림자 거리와 같아야 합니다 — 다르면 그림자가 본체 뒤로 비져 나옵니다.
 */
import { ELEVATION } from "./layout";

export const DURATION = {
  /** 눌림 · 색 바뀜 — class-explorer 의 duration-100 */
  fast: 100,
  /** 펼침 · 나타남 */
  base: 200,
  slow: 300,
  /** 시간선 위 캐럿처럼 연속으로 움직이는 위치 전용 */
  crawl: 700,
  /** 불러오는 동안의 깜빡임 한 주기 */
  pulse: 2000,
} as const;

export const EASING = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  out: "cubic-bezier(0, 0, 0.2, 1)",
  linear: "linear",
} as const;

export const PRESS = {
  /** hover 때 가라앉는 거리 = raised 그림자 거리 */
  sink: ELEVATION.raised.offset,
  /** 누르는 순간 한 번 더 작아집니다 — 컨트롤 · 배지 */
  activeScale: 0.96,
  /** 큰 면(카드)은 덜 작아집니다 — 0.96 이면 400px 카드가 16px 나 줄어듭니다 */
  surfaceScale: 0.98,
  /** 커지는 것 — 골라진 칸(Selectable 의 grow)과 hover 때의 로고 */
  grow: 1.05,
  /** 그림자를 둔 채 작아지는 단추(Ask 플로팅 버튼 · 창 머리 단추)의 hover */
  shrink: 0.95,
  /** 위 단추의 누르는 순간 */
  shrinkActive: 0.92,
} as const;

export const LIFT = {
  /** 떠오르는 카드의 높이 */
  rise: 4,
} as const;

/**
 * 등장 — 새로 나타나는 판이 아래에서 떠오르는 거리(px)와 시간. 판의 크기가 클수록 멀리서, 오래 옵니다.
 * **퇴장은 없습니다.** 닫는 모션을 보이려면 판을 그 시간만큼 더 들고 있어야 하는데, 그사이 한 번 더
 * 누르면 판 뒤의 화면이 눌립니다 (class-explorer 의 Ask 창 규칙).
 */
export const ENTER = {
  /** 기준 요소 옆에 붙는 작은 판 — 메뉴 · 툴팁 */
  rise: { distance: 4, duration: "fast" },
  /** 화면 가운데 큰 판 — 모달 */
  pop: { distance: 8, duration: "base" },
  /** 제자리에서 — 펼친 본문 (class-explorer 아코디언의 fade-in 300ms) */
  fade: { distance: 0, duration: "slow" },
  /** 앱이 만든 작은 창 — 8px 아래에서 96% 로 시작합니다 (Ask 데스크탑 창) */
  panel: { distance: 8, duration: "base", scale: 0.96 },
  /** 화면을 덮는 판 — 멀리서 옵니다 (Ask 모바일 판) */
  sheet: { distance: 24, duration: "base" },
} as const satisfies Record<string, { distance: number; duration: keyof typeof DURATION; scale?: number }>;

/** 아이콘만 움직이는 몸짓 — 돌아가는 각도(°)와 밀리는 거리(px) */
export const ICON_MOTION = {
  turn: -45,
  nudge: 2,
} as const;

/**
 * 상태(hover · 누르는 중 · 꺼짐)가 바뀔 때 움직이는 속성 — 색(Paint 의 hoverable)과 몸짓(Pressable)을 합친
 * 목록입니다. `transition-property` 는 한 속성이라 두 primitive 가 자기 것만 적으면 한 요소 위에서 나중에
 * 선언된 쪽이 앞의 전환을 지웁니다. 그래서 둘 다 이 목록을 씁니다.
 * `transition: all` 은 쓰지 않습니다 (폭이 바뀌는 컨트롤에서 글자가 상자 밖으로 비져 나옵니다).
 */
export const STATE_TRANSITION = "color, background-color, border-color, box-shadow, transform, opacity";

export const ms = (n: number) => `${n}ms`;
