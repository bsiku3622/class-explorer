/**
 * 컴포넌트 인벤토리 — funky-ui 토큰 구조를 다시 잡기 위한 작업대.
 *
 * **개발 전용입니다.** `App.tsx` 가 `import.meta.env.DEV` 일 때만 라우트를 겁니다.
 * 메뉴에도 올리지 않습니다 — 사용자가 볼 화면이 아니라 우리가 볼 표본집입니다.
 *
 * 여기 있는 표본은 **지어낸 게 아니라 코드에서 그대로 옮긴 것**입니다. 각 항목에
 * `파일:줄` 이 붙어 있으니 원본과 대조할 수 있습니다. 인벤토리의 목적은 "무엇을
 * 만들까" 가 아니라 **"우리가 이미 무엇을 만들어 버렸나"** 를 보는 것이라, 예쁘게
 * 정리하지 않고 있는 그대로 늘어놓습니다.
 *
 * ⚠️ **줄 번호는 셀 때마다 어긋납니다.** 회차를 새로 셀 때 숫자만 고치고 `src` 를
 * 그대로 두면, 대조하려고 열었을 때 엉뚱한 줄이 나옵니다 — 그러면 표본집이 거짓말을
 * 시작합니다. 셈과 위치는 **같이** 갱신합니다.
 *
 * 회차: 1회 2026-08-01 · **2회 2026-08-30**(지금). 숫자 밑의 작은 글씨가 1회 값입니다.
 *
 * 축이 정해지고 funky-ui 로 옮기고 나면 이 파일은 지웁니다.
 */

import React from "react";
import {
    ArrowRight,
    Check,
    ChevronDown,
    ChevronLeft,
    Copy,
    Link,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    X,
} from "lucide-react";
import RetroButton from "../components/atoms/RetroButton";
import RetroSpinner from "../components/atoms/RetroSpinner";
import StudentBadge from "../components/atoms/StudentBadge";

/* ────────────────────────────────────────────────────────────────────────────
   표본 틀
   ──────────────────────────────────────────────────────────────────────────── */

/** 한 표본. `src` 는 원본 위치 — 대조할 수 있게 반드시 답니다 */
const Spec: React.FC<{
    name: string;
    src?: string;
    note?: string;
    children: React.ReactNode;
}> = ({ name, src, note, children }) => (
    <div className="border-2 border-black/10 bg-white p-3">
        <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest">
                {name}
            </span>
            {src && (
                <span className="font-mono text-[10px] text-black/30">{src}</span>
            )}
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        {note && (
            <p className="mt-2.5 text-[11px] font-bold leading-snug text-black/40">
                {note}
            </p>
        )}
    </div>
);

const Section: React.FC<{
    id: string;
    title: string;
    lead?: string;
    children: React.ReactNode;
}> = ({ id, title, lead, children }) => (
    <section id={id} className="scroll-mt-24">
        <div className="mb-4 border-b-2 border-black pb-2">
            <h2 className="text-2xl font-black uppercase tracking-tighter">{title}</h2>
            {lead && (
                <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-black/50">
                    {lead}
                </p>
            )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
);

/**
 * 숫자 하나 — 인벤토리의 요지는 대부분 숫자로 드러납니다.
 * `prev` 는 1회차(2026-08-01) 값. **방향이 숫자보다 중요합니다.**
 */
const Figure: React.FC<{
    value: string;
    label: string;
    prev?: string;
    bad?: boolean;
}> = ({ value, label, prev, bad }) => (
    <div
        className={`border-2 p-3 ${
            bad ? "border-retro-primary bg-retro-primary/10" : "border-black bg-white"
        }`}
    >
        <p className="text-3xl font-black tabular-nums tracking-tighter">{value}</p>
        <p className="mt-0.5 text-[11px] font-bold leading-snug text-black/50">
            {label}
        </p>
        {prev && (
            <p className="mt-1.5 border-t-2 border-black/10 pt-1 font-mono text-[10px] text-black/30">
                1회(8/1) {prev}
            </p>
        )}
    </div>
);

/* ────────────────────────────────────────────────────────────────────────────
   자료 — 코드에서 세어 온 값들 (2026-08-30, `frontend/src`, 이 파일 제외)
   ──────────────────────────────────────────────────────────────────────────── */

/** `src/index.css` 의 `@theme` 실제 값과 funky-ui accent 이름의 대응 */
const PALETTE: {
    token: string;
    hex: string;
    funky: string;
    uses: number;
    prev: number;
    note?: string;
}[] = [
    { token: "retro-primary", hex: "#ff4eba", funky: "pink", uses: 78, prev: 54 },
    { token: "retro-accent3", hex: "#ff4eba", funky: "pink", uses: 2, prev: 3, note: "primary 와 같은 값" },
    { token: "retro-secondary", hex: "#7828c8", funky: "purple", uses: 26, prev: 13 },
    { token: "retro-accent1", hex: "#3decfd", funky: "cyan", uses: 15, prev: 9 },
    { token: "retro-accent2", hex: "#ffd500", funky: "yellow", uses: 6, prev: 2 },
    { token: "retro-accent4", hex: "#ff9100", funky: "orange", uses: 39, prev: 35 },
    { token: "retro-accent5", hex: "#00c8ff", funky: "sky", uses: 21, prev: 24 },
    { token: "retro-green", hex: "#00c22a", funky: "green", uses: 45, prev: 48 },
    { token: "retro-bg", hex: "#fff5d1", funky: "bg", uses: 11, prev: 9 },
    { token: "retro-fg", hex: "#222222", funky: "ink", uses: 3, prev: 1 },
    { token: "retro-accent-light", hex: "#f0fdff", funky: "(없음)", uses: 22, prev: 13, note: "funky 에 대응 토큰이 없습니다" },
    { token: "(없음)", hex: "#ff3b3b", funky: "red", uses: 0, prev: 0, note: "funky 에만 있는 8번째" },
];

/**
 * 코드에 실제로 등장하는 그림자 값.
 * 가이드가 규칙으로 정한 건 둘(4px·6px), funky-ui 의 사다리는 셋(4·6·8)입니다.
 */
const SHADOWS: { cls: string; count: number; where?: string }[] = [
    { cls: "shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]", count: 27, where: "기본 — RetroButton·RetroCard sm" },
    { cls: "shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]", count: 17, where: "큰 카드" },
    { cls: "shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]", count: 10 },
    { cls: "shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]", count: 9 },
    { cls: "shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]", count: 5 },
    { cls: "shadow-[4px_4px_0_0_rgba(0,0,0,0.15)]", count: 2, where: "StudentCard·TeacherCard" },
    { cls: "shadow-[0_0_15px_rgba(0,0,0,0.2)]", count: 2, where: "TimetableGrid — 유일한 블러 그림자" },
    { cls: "shadow-[8px_8px_0_0_rgba(0,0,0,0.2)]", count: 1, where: "RetroCard lg" },
    { cls: "shadow-[8px_8px_0_0_rgba(0,0,0,0.3)]", count: 1, where: "AdminPage 확인 모달" },
    { cls: "shadow-[6px_6px_0_0_rgba(0,0,0,0.1)]", count: 1 },
    { cls: "shadow-[4px_4px_0_0_rgba(0,0,0,0.25)]", count: 1, where: "BottomNav 더보기" },
    { cls: "shadow-[4px_4px_0_0_rgba(255,165,0,0.4)]", count: 1, where: "검색 경고 — 유일한 유채색 그림자" },
    { cls: "shadow-[3px_3px_0_0_rgba(0,0,0,0.18)]", count: 1, where: "DayRuler 지금" },
    { cls: "shadow-[3px_3px_0_0_rgba(0,0,0,0.1)]", count: 1 },
    { cls: "shadow-[2px_2px_0_0_rgba(0,0,0,0.12)]", count: 1, where: "zamong CourseCard focus" },
    { cls: "shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]", count: 1 },
    { cls: "shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]", count: 1, where: "StudentBadge" },
    { cls: "shadow-[0_4px_0_0_rgba(0,0,0,0.2)]", count: 1, where: "Navigation — 아래로만" },
    { cls: "shadow-[0_-4px_0_0_rgba(0,0,0,0.2)]", count: 1, where: "BottomNav — 위로만" },
];

/* ────────────────────────────────────────────────────────────────────────────
   페이지
   ──────────────────────────────────────────────────────────────────────────── */

const NAV = [
    ["count", "숫자"],
    ["atom", "공식 Atom"],
    ["fill", "색 × 강도"],
    ["neutral", "중립"],
    ["icon", "아이콘·텍스트"],
    ["select", "선택 상태"],
    ["input", "인풋"],
    ["shadow", "그림자"],
    ["color", "색 토큰"],
    ["misc", "배지·피드백"],
] as const;

const InventoryPage: React.FC = () => (
    <div className="flex flex-col gap-10 pb-32">
        {/* ── 머리말 ─────────────────────────────────────────────────────── */}
        <header className="border-2 border-black bg-white p-5 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] md:p-6">
            <p className="text-sm font-black uppercase tracking-widest text-black/40">
                Design Inventory · 2회 (2026-08-30)
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-tighter md:text-4xl">
                class-explorer 컴포넌트 표본집
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-relaxed text-black/50">
                funky-ui 토큰 구조를 다시 잡기 전에, 지금 이 앱이 실제로 그리고 있는
                것들을 종류별로 늘어놓았습니다. 표본은 전부 코드에서 그대로 옮겼고
                옆에 원본 위치를 달아 두었습니다. 개발 환경에서만 열립니다.
            </p>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-black/50">
                1회차(8/1) 이후 프론트에 커밋 57개가 쌓였습니다.{" "}
                <b className="text-black">
                    한 달 동안 원시 버튼은 76 → 113 으로 늘었습니다
                </b>{" "}
                — 축이 부족한 상태로 기능을 계속 얹으면 우회가 얼마나 빨리 쌓이는지가
                이 회차의 요지입니다.
            </p>
            <nav className="mt-4 flex flex-wrap gap-1.5">
                {NAV.map(([id, label]) => (
                    <a
                        key={id}
                        href={`#${id}`}
                        className="border-2 border-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black/50 transition-all duration-100 hover:border-black hover:text-black"
                    >
                        {label}
                    </a>
                ))}
            </nav>
        </header>

        {/* ── 숫자 ───────────────────────────────────────────────────────── */}
        <section id="count" className="scroll-mt-24">
            <div className="mb-4 border-b-2 border-black pb-2">
                <h2 className="text-2xl font-black uppercase tracking-tighter">
                    숫자로 본 현재
                </h2>
                <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-black/50">
                    축이 부족하면 사람들은 축을 우회합니다. 그 흔적이 숫자로 남아
                    있습니다. 아래 작은 글씨는 1회차 값입니다 —{" "}
                    <b className="text-black">전부 같은 방향으로 벌어졌습니다.</b>
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Figure value="113" prev="76" label="원시 <button> — 직접 그린 것" bad />
                <Figure value="33" prev="26" label="RetroButton — 공식 atom 을 쓴 것" />
                <Figure
                    value="29"
                    prev="31"
                    label="서로 다른 버튼 아키타입 (채우기 × 테두리 × 그림자)"
                    bad
                />
                <Figure value="13" prev="8" label="그중 하드 그림자를 가진 것 (정체성)" bad />
                <Figure value="19" prev="12" label="코드에 존재하는 그림자 값 (가이드 규칙은 2)" bad />
                <Figure value="41→8" prev="41" label="isSelected 가 등장하는 자리 · 그중 atom 에 넘긴 것" bad />
                <Figure value="4→3" prev="4→1" label="variant 4종 중 쓰인 것 — secondary 는 여전히 0" bad />
                <Figure value="4" label="inputClass 를 파일마다 다시 선언한 횟수" bad />
            </div>
            <p className="mt-3 max-w-3xl text-[11px] font-bold leading-relaxed text-black/40">
                아키타입만 31 → 29 로 줄었는데, 이건 나아진 게 아닙니다 — 세는 방식을
                이번 회차에 <b className="text-black">채우기 × 테두리 × 그림자</b> 세 축의
                조합으로 못박았을 뿐입니다. 같은 자로 다시 재면 다음 회차와 비교할 수
                있습니다.
            </p>
        </section>

        {/* ── 공식 Atom ──────────────────────────────────────────────────── */}
        <Section
            id="atom"
            title="공식 Atom — RetroButton"
            lead="API 가 제공하는 전부입니다. variant 4종 × size 3종 × isSelected 불리언, 그리고 1회차 이후에 붙은 color."
        >
            <Spec
                name="variant"
                src="atoms/RetroButton.tsx:22 · :55"
                note="secondary 는 여전히 코드에서 어떤 분기도 타지 않습니다 — white 와 완전히 같게 그려지는 죽은 값이고 사용처도 0입니다. primary 는 이번 회차에 처음 한 곳(ZamongPage.tsx:515)에서 쓰였습니다. 33곳 중 26곳은 variant 를 아예 생략합니다."
            >
                <RetroButton size="sm">white</RetroButton>
                <RetroButton size="sm" variant="secondary">
                    secondary
                </RetroButton>
                <RetroButton size="sm" variant="primary">
                    primary
                </RetroButton>
                <RetroButton size="sm" variant="black">
                    black
                </RetroButton>
            </Spec>

            <Spec
                name="color — 1회차 이후 새로 생긴 축"
                src="atoms/RetroButton.tsx:31 · MealCard.tsx:162"
                note="값이 런타임에 정해지는 버튼(급식 끼니)을 원시 button 으로 다시 짜지 않으려고 붙었습니다. 인라인 style 로 면을 칠하고 글자색은 readableInk() 가 정합니다. 다만 variant 와 나란한 다섯 번째 축이라 조합이 곱해집니다 — 사용처는 아직 한 곳입니다."
            >
                <RetroButton size="sm" color="#ffd500" isSelected>
                    아침
                </RetroButton>
                <RetroButton size="sm" color="#ff9100">
                    점심
                </RetroButton>
                <RetroButton size="sm" color="#7828c8">
                    저녁
                </RetroButton>
            </Spec>

            <Spec
                name="size"
                src="atoms/RetroButton.tsx:30"
                note="sm 28회 · md 5회(명시 1 + 생략 4) · lg 0회. API 기본값은 md 인데 실제로는 sm 이 기본처럼 쓰입니다. lg 는 이번 회차에 사용처가 사라졌습니다 — 지금 lg 를 쓰는 건 RetroSpinner 뿐입니다."
            >
                <RetroButton size="sm">sm</RetroButton>
                <RetroButton size="md">md</RetroButton>
                <RetroButton size="lg">lg</RetroButton>
            </Spec>

            <Spec
                name="isSelected"
                src="atoms/RetroButton.tsx:24"
                note="이름이 등장하는 자리는 41곳인데 atom 에 실제로 넘긴 건 8곳뿐입니다(BrowsePage 6 · MealCard 1 · ZamongPage 1). 나머지 33곳은 BrowsePage·RoomsPage·FilterSection·CourseGraph·CalendarGrid 안에서 같은 뜻을 원시 button 으로 다시 그린 것입니다."
            >
                <RetroButton size="sm">off</RetroButton>
                <RetroButton size="sm" isSelected>
                    on
                </RetroButton>
                <RetroButton size="sm" variant="primary" isSelected>
                    primary + on
                </RetroButton>
            </Spec>

            <Spec
                name="icon"
                src="atoms/RetroButton.tsx:27"
                note="33곳 중 15곳이 icon 을 씁니다 — 1회차보다 나아진 유일한 축입니다. 그래도 아이콘 전용(라벨 없는) 자리는 여전히 원시 button 이 많습니다: AdminPage 6개, SearchInput 2개, CalendarPage·FriendsManager·ZamongPage 각 1개."
            >
                <RetroButton size="sm" icon={<Plus size={14} strokeWidth={3} />}>
                    추가
                </RetroButton>
                <RetroButton size="sm" icon={<RefreshCw size={14} strokeWidth={3} />} />
            </Spec>
        </Section>

        {/* ── 색 × 강도 ──────────────────────────────────────────────────── */}
        <Section
            id="fill"
            title="색 × 강도 — 손으로 다시 만든 것"
            lead="TradePage 가 색마다 진한 면(solid)과 옅은 면(soft)을 짝지어 쓰고 있습니다. funky-ui 가 solid·soft·outline·ghost 로 갖고 있는 축을, 축이 없어서 자리마다 직접 적은 것입니다."
        >
            <Spec
                name="green — solid / soft"
                src="pages/TradePage.tsx:796"
                note="같은 색의 두 강도. soft 는 bg-white/50 위에 색 테두리와 색 글자를 얹는 방식입니다."
            >
                <button className="border-2 border-retro-green bg-retro-green px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black transition-all duration-100">
                    유지
                </button>
                <button className="border-2 border-retro-green bg-white/50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-retro-green transition-all duration-100 hover:bg-white/80">
                    유지
                </button>
            </Spec>

            <Spec
                name="orange — solid / soft"
                src="pages/TradePage.tsx:816"
                note="충돌하는 분반. soft 쪽은 /25 알파를 쓰고 hover 에서 /40 으로 짙어집니다 — green 의 soft 는 white/50 → white/80 이라 같은 뜻인데 만드는 방식이 다릅니다."
            >
                <button className="border-2 border-retro-accent4 bg-retro-accent4 px-2 py-1 text-[10px] font-black text-black transition-all duration-100">
                    3분반
                </button>
                <button className="border-2 border-retro-accent4 bg-retro-accent4/25 px-2 py-1 text-[10px] font-black text-retro-accent4 transition-all duration-100 hover:bg-retro-accent4/40">
                    3분반
                </button>
            </Spec>

            <Spec
                name="sky — solid / soft"
                src="pages/TradePage.tsx:1029"
                note="이동 대상. soft 가 또 다른 방식(bg-white/60 + 회색 글자)입니다. 색은 셋 다 다른데 강도 규칙은 제각각입니다."
            >
                <button className="border-2 border-retro-accent5 bg-retro-accent5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black transition-all duration-100">
                    그대로
                </button>
                <button className="border-2 border-retro-accent5 bg-white/60 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black/50 transition-all duration-100 hover:bg-white hover:text-black">
                    그대로
                </button>
            </Spec>

            <Spec
                name="pink — solid / soft"
                src="pages/TradePage.tsx:1001"
                note="드랍. solid 는 글자가 흰색, 다른 색들은 검정입니다 — 면 위 글자색이 색마다 손으로 결정돼 있습니다. 같은 버튼 하나가 action·isDropped·isMoving 세 조건으로 네 갈래를 탑니다."
            >
                <button className="border-2 border-retro-primary bg-retro-primary px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white transition-all duration-100">
                    드랍
                </button>
                <button className="border-2 border-retro-primary bg-white/50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-retro-primary transition-all duration-100 hover:bg-white/80">
                    드랍
                </button>
            </Spec>

            <Spec
                name="tonal — 배경만 옅게"
                src="pages/TradePage.tsx:1239"
                note="테두리는 검정, 면만 색을 옅게. 위의 soft 들과 또 다른 네 번째 방식입니다."
            >
                <button className="border-2 border-black bg-retro-green/20 px-2 py-1 text-[11px] font-bold transition-all duration-100 hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]">
                    세계사의이해
                </button>
                <button className="border-2 border-black bg-black px-2 py-1 text-[11px] font-bold text-white transition-all duration-100">
                    세계사의이해
                </button>
            </Spec>

            <Spec
                name="dim — 고를 수 없음"
                src="pages/TradePage.tsx:1284"
                note="disabled 가 아니라 '누를 수는 있지만 권하지 않는' 상태입니다. 표준 disabled 스타일(opacity 값이 자리마다 다름)과 별개로 존재합니다."
            >
                <button className="border-2 border-black bg-white px-2 py-1 text-[11px] font-bold transition-all duration-100">
                    미적분학1
                </button>
                <button className="border-2 border-black/20 bg-black/[0.03] px-2 py-1 text-[11px] font-bold text-black/40 transition-all duration-100">
                    미적분학1
                </button>
            </Spec>
        </Section>

        {/* ── 중립 ───────────────────────────────────────────────────────── */}
        <Section
            id="neutral"
            title="중립 — 색 없는 버튼"
            lead="가장 많은 무리입니다. 채우기 방식 축이 없어서 outline·ghost·translucent 가 전부 손으로 그려져 있습니다."
        >
            <Spec
                name="outline (연한 테두리)"
                src="pages/AdminPage.tsx:184 · SearchPage.tsx:81"
                note="border-black/30 → hover 에 border-black. 앱에서 가장 흔한 버튼 모양인데 atom 에는 없습니다. AdminPage 한 파일에만 여섯 번 다시 적혀 있습니다(184·648·846·1021·1214…)."
            >
                <button className="border-2 border-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black/40 transition-all duration-100 hover:border-black hover:text-black">
                    이름 바꾸기
                </button>
                <button className="flex items-center gap-2 border-2 border-black/30 px-3 py-2 text-xs font-black uppercase text-black/50 transition-all duration-100 hover:border-black hover:text-black">
                    <Link size={13} strokeWidth={2.5} />
                    Share
                </button>
            </Spec>

            <Spec
                name="solid black"
                src="pages/AdminPage.tsx:654 · RequestSidebar.tsx:95"
                note="확정 동작. hover 가 bg-black/80 인 곳과 아무것도 없는 곳이 섞여 있고, disabled 도 opacity-40 과 50 으로 갈립니다."
            >
                <button className="border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase text-white transition-all duration-100 hover:bg-black/80">
                    동기화
                </button>
                <button className="flex items-center justify-center gap-1 border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40">
                    허용
                </button>
            </Spec>

            <Spec
                name="white + 하드 그림자 (정체성)"
                src="components/SearchResultDisplay.tsx:691"
                note="113개 중 이 눌림 피드백을 가진 건 13개뿐입니다(1회차엔 8개). 시스템의 시그니처인데 실제로는 여전히 예외에 가깝습니다."
            >
                <button className="flex items-center gap-3 border-2 border-black bg-white px-10 py-4 text-lg font-black uppercase tracking-tighter shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] transition-colors hover:bg-retro-accent-light active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                    전체 보기
                    <ArrowRight size={18} strokeWidth={3} />
                </button>
            </Spec>

            <Spec
                name="translucent (어두운 배경 위)"
                src="Navigation.tsx:59 · TermSwitcher.tsx:47 · BottomNav.tsx:144"
                note="네비게이션이 보라색이라 흰색 알파로 그립니다. 알파 값이 자리마다 다릅니다 — border-white/30 + bg-white/10 이 셋, border-white/25 + bg-white/5 가 하나, border-white + bg-white/25 가 하나."
            >
                <div className="flex flex-wrap items-center gap-2 bg-retro-secondary p-2">
                    <button className="flex items-center gap-2 border-2 border-white/30 bg-white/10 px-3 py-1.5 text-white transition-all duration-100 hover:border-white hover:bg-white/20">
                        <span className="text-xs font-black uppercase">2026-2</span>
                    </button>
                    <button className="border-2 border-white/30 bg-white/10 px-3 py-1.5 text-xs font-black uppercase text-white transition-all duration-100 hover:border-white hover:bg-white/20">
                        로그아웃
                    </button>
                    <button className="flex h-7 w-7 items-center justify-center border-2 border-white/25 bg-white/5 text-white/50 transition-colors duration-100 active:bg-white/20 active:text-white">
                        <Plus size={14} strokeWidth={3} />
                    </button>
                </div>
            </Spec>

            <Spec
                name="색 테두리 + 색 글자 (outline accent)"
                src="components/RequestSidebar.tsx:102"
                note="면 없이 테두리와 글자만 색. 위의 soft 들과 또 다른 방식입니다."
            >
                <button className="flex items-center justify-center gap-1 border-2 border-retro-primary px-2 py-1 text-[10px] font-black uppercase tracking-widest text-retro-primary disabled:opacity-40">
                    거절
                </button>
            </Spec>

            <Spec
                name="hover 반전"
                src="pages/CalendarPage.tsx:223 · MealCard.tsx:130"
                note="평소 흰 면, hover 에 통째로 검정. 바로 옆 급식 카드의 같은 화살표 버튼은 hover 에 accent-light 가 되고 active 에 scale-95 로 눌립니다 — 같은 동작, 같은 아이콘, 다른 피드백."
            >
                <button className="border-2 border-black bg-white p-1.5 transition-all duration-100 hover:bg-black hover:text-white">
                    <ChevronLeft size={16} strokeWidth={3} />
                </button>
                <button className="border-2 border-black bg-white p-0.5 transition-all duration-100 hover:bg-retro-accent-light active:scale-95 disabled:opacity-25">
                    <ChevronLeft size={16} strokeWidth={3} />
                </button>
                <button className="flex h-7 w-7 items-center justify-center border-2 border-black/20 bg-white transition-colors duration-100 hover:border-black disabled:opacity-25">
                    <ChevronLeft size={16} strokeWidth={3} />
                </button>
            </Spec>
        </Section>

        {/* ── 아이콘·텍스트 ──────────────────────────────────────────────── */}
        <Section
            id="icon"
            title="아이콘 전용 · 텍스트형"
            lead="테두리도 배경도 없는 무리가 39개로 가장 큽니다(1회차 25개). atom 으로는 전혀 표현할 수 없는 종류라, 늘어나는 속도도 여기가 제일 빠릅니다."
        >
            <Spec
                name="아이콘만 (ghost)"
                src="FriendsManager.tsx:196 · AdminPage.tsx:206 · :711 · CalendarPage.tsx:352"
                note="색이 자리마다 다릅니다 — black/25, black/40, red-500, green-600. red-500·green-600 은 Tailwind 기본 팔레트로 retro 토큰 바깥이고, hover 색도 black / retro-primary 두 갈래입니다."
            >
                <button className="text-black/25 transition-colors hover:text-black">
                    <X size={14} strokeWidth={3} />
                </button>
                <button className="text-red-500 transition-colors hover:text-red-700">
                    <Trash2 size={14} strokeWidth={3} />
                </button>
                <button className="text-green-600 transition-colors hover:text-green-800">
                    <Check size={14} strokeWidth={3} />
                </button>
                <button className="text-black/25 transition-colors hover:text-retro-primary">
                    <X size={14} strokeWidth={3} />
                </button>
            </Spec>

            <Spec
                name="텍스트형 (link)"
                src="molecules/BarChartRow.tsx:61 · FilterSection.tsx:47 · home/WeekTimetable.tsx:381"
                note="밑줄이 붙는 것과 안 붙는 것, hover 색이 primary 인 것과 black 인 것이 섞여 있습니다. 홈 카드들은 또 다른 눈금(text-[11px] text-black/45)을 씁니다."
            >
                <button className="text-xs font-black uppercase transition-all hover:text-retro-primary hover:underline hover:decoration-2 hover:underline-offset-4">
                    미적분학1
                </button>
                <button className="text-xs font-black uppercase underline transition-colors hover:text-retro-primary">
                    전체 해제
                </button>
                <button className="flex items-center gap-1.5 text-[11px] font-black text-black/45 transition-colors duration-100 hover:text-black">
                    <RefreshCw size={12} strokeWidth={3} />
                    이번 주
                </button>
            </Spec>

            <Spec
                name="목록 행 (전체가 버튼)"
                src="SearchResultDisplay.tsx:304 · :556 · AnalysisPage.tsx:463"
                note="왼쪽 굵은 선이 hover 에 진해집니다. 같은 파일 안에서도 띠가 black/10 과 black/20 으로 갈립니다."
            >
                <div className="w-full space-y-1">
                    <button className="w-full truncate border-l-4 border-black/10 py-1 pl-3 text-left text-xs font-bold transition-all hover:border-black hover:bg-black/5">
                        미적분학1 · 1분반
                    </button>
                    <button className="flex w-full items-center border-b border-black/5 p-3 text-left transition-colors hover:bg-retro-accent-light">
                        <span className="text-xs font-bold">세계사의이해</span>
                    </button>
                </div>
            </Spec>

            <Spec
                name="복사 버튼"
                src="atoms/CopyButton.tsx:44"
                note="성공 상태가 색으로 바뀌는 유일한 버튼입니다. 이 '일시적 성공' 상태를 표현하는 축이 따로 없습니다."
            >
                <button className="flex items-center gap-1.5 border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-all duration-100 hover:shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]">
                    <Copy size={12} strokeWidth={3} />
                    복사
                </button>
                <button className="flex items-center gap-1.5 border-2 border-retro-green bg-retro-green px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-all duration-100">
                    <Check size={12} strokeWidth={3} />
                    복사됨
                </button>
            </Spec>
        </Section>

        {/* ── 선택 상태 ──────────────────────────────────────────────────── */}
        <Section
            id="select"
            title="선택 상태 — pill · segment"
            lead="같은 뜻(고른 것 = 검정)을 여섯 곳에서 각각 적었습니다. isSelected 라는 이름이 41곳에 흩어져 있는 이유이기도 합니다."
        >
            <Spec
                name="pill / chip — 파일마다 하나씩 있는 문자열 함수"
                src="EventFormModal.tsx:116 · AdminPage.tsx:558"
                note="두 파일이 각자 지역 헬퍼(pill·chipClass)를 갖고 있습니다. 켜진 쪽은 bg-black text-white 로 완전히 같고, 꺼진 쪽도 border-black/30 text-black/50 로 같습니다 — 다른 건 여백과 글자 크기뿐입니다. 컴포넌트가 아니라 문자열 함수라 파일 밖으로 나가지 못합니다."
            >
                <button className="border-2 border-black bg-black px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white transition-all duration-100">
                    종일
                </button>
                <button className="border-2 border-black/30 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-black/40 transition-all duration-100 hover:border-black hover:text-black">
                    시각
                </button>
                <button className="border-2 border-black bg-black px-3 py-1.5 text-xs font-black uppercase transition-all duration-100 text-white">
                    2026-2
                </button>
                <button className="border-2 border-black/30 px-3 py-1.5 text-xs font-black uppercase text-black/50 transition-all duration-100 hover:border-black hover:text-black">
                    2026-1
                </button>
            </Spec>

            <Spec
                name="segment (붙은 버튼들)"
                src="pages/AdminPage.tsx:698 · :778 · :1115 · :1179"
                note="-ml-0.5 first:ml-0 로 테두리를 겹치고 선택된 것에 relative z-10 을 줍니다. 그룹 개념이 없어 한 파일 안에서 네 번 다시 적혀 있습니다."
            >
                <div className="flex">
                    <button className="relative z-10 border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase text-white transition-all duration-100">
                        user
                    </button>
                    <button className="-ml-0.5 border-2 border-black/30 bg-white px-2 py-1 text-[10px] font-black uppercase text-black/40 transition-all duration-100 hover:border-black hover:text-black">
                        manager
                    </button>
                    <button className="-ml-0.5 border-2 border-black/30 bg-white px-2 py-1 text-[10px] font-black uppercase text-black/40 transition-all duration-100 hover:border-black hover:text-black">
                        admin
                    </button>
                </div>
            </Spec>

            <Spec
                name="탭 (면색 전환)"
                src="components/SearchResultDisplay.tsx:471"
                note="선택된 쪽에 배경을 안 주고 부모가 칠합니다 — 위 pill 과 정반대 방식입니다."
            >
                <div className="flex border-2 border-black">
                    <button className="flex items-center gap-2 bg-black px-3 py-1.5 text-xs font-black text-white transition-all duration-200">
                        시간표
                    </button>
                    <button className="flex items-center gap-2 bg-white px-3 py-1.5 text-xs font-black text-black/30 transition-all duration-200 hover:bg-retro-accent-light hover:text-black">
                        목록
                    </button>
                </div>
            </Spec>

            <Spec
                name="내비게이션 항목 — 두 곳이 다른 말을 합니다"
                src="components/Sidebar.tsx:28 · BottomNav.tsx:31"
                note="사이드바는 '선택 = 검은 면 + 하드 그림자', 하단 내비는 '선택 = 윗변 흰 선'. 같은 화면 폭만 다른 같은 메뉴인데 선택을 알리는 신호가 아예 다릅니다."
            >
                <div className="w-full space-y-1">
                    <button className="flex w-full items-center gap-3 border-2 border-black bg-black px-4 py-3 font-black uppercase text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
                        <Search size={16} strokeWidth={3} />
                        Search
                    </button>
                    <button className="flex w-full items-center gap-3 border-2 border-transparent px-4 py-3 font-black uppercase text-black/60 transition-all duration-100 hover:bg-white/50 hover:text-black">
                        <Plus size={16} strokeWidth={3} />
                        Browse
                    </button>
                    <div className="flex bg-retro-secondary">
                        <button className="flex flex-1 flex-col items-center justify-center gap-1 border-2 border-transparent border-t-white/30 py-2 text-white transition-all duration-100">
                            <Search size={20} strokeWidth={2.5} />
                            <span className="text-[9px] font-black uppercase tracking-tight">
                                Search
                            </span>
                        </button>
                        <button className="flex flex-1 flex-col items-center justify-center gap-1 border-2 border-transparent py-2 text-white/50 transition-all duration-100 hover:text-white/80">
                            <Plus size={20} strokeWidth={2.5} />
                            <span className="text-[9px] font-black uppercase tracking-tight">
                                Browse
                            </span>
                        </button>
                    </div>
                </div>
            </Spec>

            <Spec
                name="교시 칸 (scale 로 선택)"
                src="pages/RoomsPage.tsx:187"
                note="선택을 scale-105 + z-10 으로 표현합니다. RetroButton 의 isSelected 와 같은 방식인데 원시 button 으로 다시 적혀 있습니다."
            >
                <div className="flex gap-1">
                    <button className="z-10 flex h-14 min-w-[72px] scale-105 flex-col items-center justify-center border-2 border-black bg-black p-1.5 text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:shadow-none">
                        <span className="text-xs font-black">1교시</span>
                    </button>
                    <button className="flex h-14 min-w-[72px] flex-col items-center justify-center border-2 border-black bg-white p-1.5 transition-all duration-100 hover:bg-retro-accent-light">
                        <span className="text-xs font-black">2교시</span>
                    </button>
                </div>
            </Spec>
        </Section>

        {/* ── 인풋 ───────────────────────────────────────────────────────── */}
        <Section
            id="input"
            title="인풋"
            lead="24개 input · 4개 select · 1개 textarea. 공통 atom 은 SearchInput 하나뿐이고, 폼 인풋은 지역 상수 inputClass 를 네 곳에서 각각 선언해 씁니다."
        >
            <Spec
                name="SearchInput — 유일한 공식 인풋"
                src="atoms/SearchInput.tsx:110"
                note="size 는 lg·sm 두 단입니다. 버튼(sm·md·lg)과 단이 맞지 않습니다."
            >
                <div className="w-full space-y-2">
                    <div className="relative">
                        <Search
                            size={18}
                            strokeWidth={3}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-black/20"
                        />
                        <input
                            readOnly
                            placeholder="이름이나 학번으로 찾기"
                            className="w-full border-2 border-black bg-white py-2 pl-10 pr-3 text-sm font-bold placeholder:text-black/30 focus:outline-none"
                        />
                    </div>
                    <div className="relative">
                        <Search
                            size={22}
                            strokeWidth={3}
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20"
                        />
                        <input
                            readOnly
                            placeholder="과목·교사·학생·강의실"
                            className="w-full border-2 border-black bg-white py-4 pl-12 pr-4 text-lg font-bold placeholder:text-black/30 focus:outline-none"
                        />
                    </div>
                </div>
            </Spec>

            <Spec
                name="inputClass — 같은 상수를 네 번 선언"
                src="AdminPage.tsx:173 · :525 · LoginPage.tsx:47 · EventFormModal.tsx:112"
                note="AdminPage 의 두 개는 글자까지 똑같고, LoginPage 는 여백만 다르고(px-4 py-3), EventFormModal 은 그림자가 빠져 있습니다. 파일 밖으로 나갈 수 없는 문자열이라 네 번째가 생기는 걸 아무도 못 막습니다."
            >
                <div className="w-full space-y-2">
                    <input
                        readOnly
                        placeholder="Admin · Login — 그림자 있음"
                        className="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] placeholder:text-black/20 focus:outline-none"
                    />
                    <input
                        readOnly
                        placeholder="EventFormModal — 그림자 없음"
                        className="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold placeholder:text-black/20 focus:outline-none"
                    />
                </div>
            </Spec>

            <Spec
                name="focus 규칙이 서로 반대입니다"
                src="LoginPage.tsx:47 ↔ TradePage.tsx:578 · AnalysisPage.tsx:449"
                note="Login·Admin 은 평소 그림자가 있다가 focus 에 사라지고(focus:shadow-none), Trade 는 평소 없다가 focus 에 생깁니다(focus:shadow-[4px_4px…]). EventFormModal 은 focus 표시가 아예 없고, Analysis 는 또 다른 값(0.1 알파)을 씁니다. focus 링 규칙이 시스템에 없어서 네 방향으로 갈렸습니다."
            >
                <div className="w-full space-y-2">
                    <input
                        readOnly
                        placeholder="평소 있고 → focus 에 사라짐"
                        className="w-full border-2 border-black bg-white px-4 py-3 text-sm font-bold shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] placeholder:text-black/20 focus:shadow-none focus:outline-none"
                    />
                    <input
                        readOnly
                        placeholder="평소 없고 → focus 에 생김"
                        className="w-full border-2 border-black bg-white px-4 py-3 text-sm font-bold placeholder:text-black/20 focus:shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] focus:outline-none"
                    />
                </div>
            </Spec>

            <Spec
                name="select — 기본 모양을 지우고 다시 그림"
                src="components/zamong/CourseCard.tsx:71 · EventFormModal.tsx:208"
                note="Zamong 은 appearance-none 으로 화살표까지 지우고 ChevronDown 을 절대 배치로 다시 얹습니다. EventFormModal 의 select 는 브라우저 기본 모양 그대로입니다 — 같은 앱 안에 두 종류의 select 가 있습니다."
            >
                <div className="flex w-full flex-wrap items-center gap-2">
                    <span className="relative inline-block">
                        <select className="h-7 w-32 cursor-pointer appearance-none border-2 border-black bg-white pl-1.5 pr-5 text-[13px] font-black outline-none">
                            <option>미적분학1</option>
                        </select>
                        <ChevronDown
                            size={13}
                            strokeWidth={3}
                            className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2"
                        />
                    </span>
                    <select className="border-2 border-black bg-white px-3 py-2 text-sm font-bold focus:outline-none">
                        <option>개인 일정</option>
                    </select>
                </div>
            </Spec>

            <Spec
                name="체크박스 — 감추고 직접 그립니다"
                src="components/FilterSection.tsx:76 · BrowsePage.tsx:270"
                note="1회차의 '브라우저 기본 체크박스' 는 사라졌습니다. 지금은 input 을 hidden 으로 감추고 옆에 border-2 border-black 네모를 직접 그린 뒤 style 로 면을 칠합니다 — 색이 학번 색이라 토큰이 아니라 런타임 값입니다."
            >
                <label className="flex cursor-pointer items-center gap-2 border-2 border-black bg-white px-2 py-1 text-sm font-bold shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                    <input type="checkbox" defaultChecked className="hidden" />
                    <span
                        className="h-4 w-4 shrink-0 border-2 border-black"
                        style={{ backgroundColor: "#ff9100" }}
                    />
                    24학번
                </label>
                <label
                    className="flex cursor-pointer items-center gap-2 border-2 bg-white px-2 py-1 text-sm font-bold opacity-40 grayscale"
                    style={{ borderColor: "#e5e7eb" }}
                >
                    <input type="checkbox" className="hidden" />
                    <span className="h-4 w-4 shrink-0 border-2 border-black" />
                    25학번
                </label>
            </Spec>

            <Spec
                name="disabled"
                src="여러 곳 — disabled:opacity-*"
                note="opacity 값이 40(12곳) · 25(4곳) · 50(3곳) · 30(1곳) 네 가지로 흩어져 있습니다. 1회차와 똑같이 넷입니다 — 이 자리는 한 달 동안 그대로였습니다."
            >
                <button className="border-2 border-black bg-white p-1 opacity-25" disabled>
                    <ChevronLeft size={16} strokeWidth={3} />
                </button>
                <button className="border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase text-white opacity-30" disabled>
                    삭제
                </button>
                <button className="border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase text-white opacity-40" disabled>
                    허용
                </button>
                <button className="border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase text-white opacity-50" disabled>
                    만들기
                </button>
            </Spec>
        </Section>

        {/* ── 그림자 ─────────────────────────────────────────────────────── */}
        <section id="shadow" className="scroll-mt-24">
            <div className="mb-4 border-b-2 border-black pb-2">
                <h2 className="text-2xl font-black uppercase tracking-tighter">
                    그림자 사다리
                </h2>
                <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-black/50">
                    design-guide.md 가 규칙으로 정한 건 둘(4px·6px), funky-ui 의 사다리는
                    셋(4·6·8)인데 코드에는 <b className="text-black">19개</b>가 있습니다
                    (1회차 12개). 오프셋 5단 × 투명도 8단이 뒤섞였고, 그중 넷은 하드
                    그림자조차 아닙니다 — 블러 하나, 한쪽 방향 둘, 유채색 하나.
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {SHADOWS.map((s) => (
                    <div key={s.cls} className="border-2 border-black/10 bg-white p-3">
                        <div
                            className={`mb-3 h-10 border-2 border-black bg-white ${s.cls}`}
                        />
                        <p className="font-mono text-[10px] leading-tight text-black/40">
                            {s.cls.replace("shadow-[", "").replace("]", "")}
                        </p>
                        <p className="mt-1 text-[10px] font-black">{s.count}회</p>
                        {s.where && (
                            <p className="mt-0.5 text-[10px] font-bold leading-snug text-black/30">
                                {s.where}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </section>

        {/* ── 색 토큰 ────────────────────────────────────────────────────── */}
        <section id="color" className="scroll-mt-24">
            <div className="mb-4 border-b-2 border-black pb-2">
                <h2 className="text-2xl font-black uppercase tracking-tighter">
                    색 토큰
                </h2>
                <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed text-black/50">
                    이름은 자리(accent1…5)를 가리키고 뜻을 가리키지 않습니다. 그런데{" "}
                    <b className="text-black">값은 funky-ui 의 accent 와 전부 같습니다</b>{" "}
                    — 옮길 때 색을 새로 고를 필요가 없다는 뜻입니다. 한 달 사이 사용량이
                    가장 많이 는 건 핑크(54 → 78)입니다.
                </p>
            </div>
            <div className="overflow-x-auto border-2 border-black bg-white">
                <table className="w-full min-w-[720px] text-left">
                    <thead className="border-b-2 border-black bg-retro-bg">
                        <tr className="text-[10px] font-black uppercase tracking-widest">
                            <th className="p-2.5">색</th>
                            <th className="p-2.5">class-explorer</th>
                            <th className="p-2.5">hex</th>
                            <th className="p-2.5">funky-ui</th>
                            <th className="p-2.5 text-right">사용</th>
                            <th className="p-2.5 text-right">1회</th>
                            <th className="p-2.5">비고</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {PALETTE.map((c) => (
                            <tr key={c.token + c.funky} className="text-xs font-bold">
                                <td className="p-2.5">
                                    <span
                                        className="block h-6 w-10 border-2 border-black"
                                        style={{ backgroundColor: c.hex }}
                                    />
                                </td>
                                <td className="p-2.5 font-mono">{c.token}</td>
                                <td className="p-2.5 font-mono text-black/50">{c.hex}</td>
                                <td className="p-2.5 font-black">{c.funky}</td>
                                <td className="p-2.5 text-right tabular-nums">
                                    {c.uses}
                                </td>
                                <td className="p-2.5 text-right font-mono tabular-nums text-black/30">
                                    {c.prev}
                                </td>
                                <td className="p-2.5 text-black/40">{c.note ?? ""}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Spec
                    name="1회차가 지적한 자리 — 고쳐졌습니다"
                    src="design-guide.md ↔ index.css"
                    note="1회차에는 design-guide.md 의 색 표가 코드와 어긋나 있었습니다 — primary 를 #ff3e3e(빨강), bg 를 #f8f5f0, fg 를 #000000 으로 적고 있었습니다. 지금은 셋 다 코드와 같습니다. 남아 있는 어긋남은 그림자 쪽입니다."
                >
                    <div className="flex gap-2">
                        <div className="border-2 border-black/20 opacity-40">
                            <div
                                className="h-10 w-20"
                                style={{ backgroundColor: "#ff3e3e" }}
                            />
                            <p className="border-t-2 border-black/20 px-1 py-0.5 text-center font-mono text-[9px]">
                                1회 가이드
                            </p>
                        </div>
                        <div className="border-2 border-black">
                            <div
                                className="h-10 w-20"
                                style={{ backgroundColor: "#ff4eba" }}
                            />
                            <p className="border-t-2 border-black px-1 py-0.5 text-center font-mono text-[9px]">
                                지금 (둘 다)
                            </p>
                        </div>
                    </div>
                </Spec>
                <Spec
                    name="토큰 바깥 색"
                    src="AdminPage.tsx · GoogleLoginButton.tsx · FilterSection.tsx"
                    note="Tailwind 기본 팔레트가 37곳(red·orange·green 계열이 대부분), 하드코딩 hex 가 41곳(20종)입니다. 구글 브랜드 색 넷과 #e5e7eb(체크박스 꺼진 테두리) 같은 회색이 토큰을 우회해 들어와 있습니다."
                >
                    <span className="border-2 border-black bg-red-500 px-2 py-1 text-[10px] font-black text-white">
                        red-500
                    </span>
                    <span className="border-2 border-black bg-green-600 px-2 py-1 text-[10px] font-black text-white">
                        green-600
                    </span>
                    <span className="border-2 border-black bg-orange-100 px-2 py-1 text-[10px] font-black">
                        orange-100
                    </span>
                    <span className="border-2 border-black px-2 py-1 text-[10px] font-black text-white" style={{ backgroundColor: "#4285F4" }}>
                        #4285F4
                    </span>
                    <span className="border-2 px-2 py-1 text-[10px] font-black text-black/40" style={{ borderColor: "#e5e7eb" }}>
                        #e5e7eb
                    </span>
                </Spec>
            </div>
        </section>

        {/* ── 배지·피드백 ────────────────────────────────────────────────── */}
        <Section
            id="misc"
            title="배지 · 피드백"
            lead="버튼 바깥의 작은 것들. 여기도 같은 문제가 반복되지만, 잘 지켜지는 자리도 둘 있습니다."
        >
            <Spec
                name="StudentBadge"
                src="atoms/StudentBadge.tsx:40"
                note="학번 앞 두 자리로 색이 정해집니다. 색 + 알파 면 + 색 글자 — 위에서 본 soft 변형과 같은 구조인데 따로 구현돼 있습니다. 앱에서 유일하게 0.05 알파 그림자를 씁니다."
            >
                <StudentBadge studentId="23-001" studentName="김" />
                <StudentBadge studentId="24-002" studentName="이" />
                <StudentBadge studentId="25-003" studentName="박" />
                <StudentBadge studentId="26-004" studentName="최" />
            </Spec>

            <Spec
                name="상태 칸 — STATE_STYLE"
                src="components/SectionsTimetable.tsx:28"
                note="세 상태를 한 Record 에 모아 둔 건 옳은 방향인데, 만드는 방식은 여전히 셋 다 다릅니다 — 진한 면 + 검정 테두리 / 25% 면 + 색 테두리 + 검정 글자 / 25% 면 + 색 테두리 + 색 글자."
            >
                <span className="border-2 border-black bg-retro-accent1 px-1 py-0.5 text-[10px] font-black leading-none">
                    2
                </span>
                <span className="border-2 border-retro-green bg-retro-green/25 px-1 py-0.5 text-[10px] font-black leading-none text-black">
                    3
                </span>
                <span className="border-2 border-retro-accent4 bg-retro-accent4/25 px-1 py-0.5 text-[10px] font-black leading-none text-retro-accent4">
                    4
                </span>
                <span className="border-2 border-retro-green bg-retro-green/25 px-1 py-0.5 text-[10px] font-black leading-none text-black opacity-25">
                    5
                </span>
            </Spec>

            <Spec
                name="RetroChip — 아무것도 정하지 않는 atom"
                src="atoms/RetroChip.tsx"
                note="HeroUI Chip 자리에 들어왔는데, 쓰던 쪽이 색·테두리·그림자를 전부 className 으로 넘기고 있어서 남은 건 '가운데 정렬된 인라인 상자' 뿐입니다. atom 이 아무 결정도 하지 않으면 축이 생기지 않습니다 — 옮길 때 이건 없애는 쪽이 맞습니다."
            >
                <span className="inline-flex items-center justify-center whitespace-nowrap border-2 border-black bg-retro-accent2 px-2 py-0.5 text-[10px] font-black">
                    12
                </span>
                <span className="inline-flex items-center justify-center whitespace-nowrap border-2 border-black/20 px-2 py-0.5 text-[10px] font-black text-black/40">
                    0
                </span>
            </Spec>

            <Spec
                name="RetroSpinner"
                src="atoms/RetroSpinner.tsx"
                note="paper-ui 에서 옮겨 왔습니다. funky-ui 카탈로그 23개에 스피너가 없어서 생긴 일입니다 — 인벤토리가 찾아낸 첫 번째 구멍이고, 이번 회차에도 그대로입니다. 이 앱에서 size='lg' 를 쓰는 유일한 컴포넌트이기도 합니다."
            >
                <RetroSpinner size="sm" />
                <RetroSpinner size="md" />
                <RetroSpinner size="lg" />
            </Spec>

            <Spec
                name="빈 상태 — 같은 문구, 다른 눈금"
                src="MealCard.tsx:186 · SearchPage.tsx:161"
                note="글자가 No Data Found 로 같은데 하나는 text-xs black/25, 다른 하나는 text-2xl black/20 입니다. 빈 상태 컴포넌트가 없어서 크기와 농도를 자리마다 다시 고릅니다."
            >
                <div className="w-full space-y-2">
                    <div className="flex w-full items-center justify-center border-2 border-black/10 py-6">
                        <p className="text-xs font-black uppercase tracking-widest text-black/25">
                            No Data Found
                        </p>
                    </div>
                    <div className="flex w-full items-center justify-center border-2 border-black/10 py-6">
                        <p className="text-2xl font-black uppercase tracking-widest text-black/20">
                            No Data Found
                        </p>
                    </div>
                </div>
            </Spec>

            <Spec
                name="잘 지켜지는 축 둘"
                src="atoms/RetroSubTitle.tsx · lib/calendar.ts:162"
                note="RetroSubTitle 은 스타일이 고정돼 있고 우회 사례가 없습니다. CATEGORY_STYLE 은 여섯 종류의 dot·chip 을 한 곳에 모아 두고 전부 같은 형식을 씁니다. 둘 다 축이 좁아서 지켜졌습니다 — 넓은 축(variant 4 × size 3 × isSelected)일수록 우회당했습니다."
            >
                <div className="w-full space-y-2">
                    <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-black/40">
                        <Search size={18} className="text-black/40" />
                        Meal
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="bg-retro-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-retro-primary">
                            휴일
                        </span>
                        <span className="bg-retro-secondary/15 px-1.5 py-0.5 text-[11px] font-bold text-retro-secondary">
                            시험
                        </span>
                        <span className="bg-retro-accent4/20 px-1.5 py-0.5 text-[11px] font-bold text-black">
                            학기
                        </span>
                        <span className="bg-retro-accent5/20 px-1.5 py-0.5 text-[11px] font-bold text-black">
                            기숙사
                        </span>
                        <span className="bg-black/[0.07] px-1.5 py-0.5 text-[11px] font-bold text-black/70">
                            학사
                        </span>
                    </div>
                </div>
            </Spec>
        </Section>
    </div>
);

export default InventoryPage;
