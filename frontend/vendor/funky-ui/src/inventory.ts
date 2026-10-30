/**
 * 인벤토리 — 이름 · 층 · 순서의 정본입니다. import 가 없습니다.
 *
 * Playground 사이드바와 문서 목차가 여기서 파생합니다. 컴포넌트를 더하거나 빼면 여기를 같이
 * 고칩니다. 층은 아래로만 의존합니다:
 *
 *   Foundations(Color · Typography → Shape → Layout → Motion) → Primitives → Atoms → Molecules → Components
 *
 * Atoms · Molecules 까지는 어떤 앱에도 쓸 수 있는 범용 층이고, Components 는 class-explorer 전용입니다.
 */
export const LAYERS = ["foundations", "primitives", "atoms", "molecules", "components"] as const;
export type Layer = (typeof LAYERS)[number];

export const FOUNDATIONS = ["color", "typography", "shape", "layout", "motion"] as const;

export const INVENTORY = {
  primitives: {
    // 1차 — 서로 기대지 않는 바탕
    element: ["Box"],
    content: ["Text", "Icon"],
    a11y: ["VisuallyHidden", "Portal"],
    // 2차 — Box 위에 능력 하나
    /** 칠하는 셋 — 박스는 Surface(자리의 면), 요소는 Paint(accent × variant), 색 바 위는 Glass(유리). accent 는 Paint 만 갖습니다 */
    paint: ["Surface", "Paint", "Glass"],
    /** 누름은 순간의 반응(몸짓), 골라짐은 남아 있는 상태(aria · 커지기) — 고르는 칸은 둘을 같이 씁니다 */
    press: ["Pressable"],
    select: ["Selectable"],
    /** 떠 있는 판 — 어디에(기준 요소 옆 · 문서 끝) · 언제(닫자고 알리기 · 등장) */
    float: ["Floating"],
    layout: ["Stack", "Inline", "Grid"],
  },
  atoms: {
    action: ["Button", "IconButton", "NavButton", "Link"],
    display: ["Badge", "Code", "Swatch", "Wordmark", "Marquee", "Spinner", "Divider"],
    input: ["Input", "Textarea", "Select", "Checkbox", "Radio", "Switch", "Label"],
  },
  molecules: {
    surface: ["Card", "SectionTitle", "PageHeader", "Accordion"],
    choice: ["SegmentedControl", "Tabs", "Menu"],
    overlay: ["Modal", "Drawer", "Tooltip", "Popover"],
    form: ["SearchField", "FormField", "FileDrop"],
    data: ["Stat", "Meter", "Table"],
    feedback: ["Notice", "Busy", "EmptyState"],
  },
  components: {
    shell: ["AppBar", "SideNav", "BottomNav", "TermSwitcher"],
    people: ["StudentBadge", "PersonCard"],
    schedule: ["ClassTile", "TimetableGrid", "BreakBand", "TimeCaret", "SlotCell"],
    /** 실행 중의 색(학과 · 학번)으로 칠하는 부품 — Paint 는 hex 를 받지 않으므로 이 층에만 있습니다 */
    tone: ["ToneButton", "ToneChip", "ToneBox", "ToneSwatch", "ToneText"],
  },
} as const;

type PrimitiveGroup = keyof (typeof INVENTORY)["primitives"];

/**
 * Primitive 의 두 단. 1차는 서로 기대지 않는 바탕(요소 · 글자 · 아이콘 · 접근성)이고, 2차는 Box 위에
 * 능력 하나를 얹은 것(칠 · 누름 · 골라짐 · 띄우기 · 배치)입니다. 2차끼리도 서로 기대지 않습니다 — 둘 이상이
 * 필요하면 위 층(Atom 부터)이 훅(`usePressable` · `useSelectable`)과 class 로 묶습니다.
 * Button = Pressable + Selectable + Paint, 누르는 Card = Pressable + Surface, Menu = Floating + Surface + 고르는 무리.
 */
export const PRIMITIVE_TIERS = {
  first: ["element", "content", "a11y"],
  second: ["paint", "press", "select", "float", "layout"],
} as const satisfies Record<"first" | "second", readonly PrimitiveGroup[]>;
