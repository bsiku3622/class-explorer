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
 * 축이 정해지고 funky-ui 로 옮기고 나면 이 파일은 지웁니다.
 */

import React from "react";
import {
    ArrowRight,
    Check,
    ChevronLeft,
    Copy,
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

/** 숫자 하나 — 인벤토리의 요지는 대부분 숫자로 드러납니다 */
const Figure: React.FC<{ value: string; label: string; bad?: boolean }> = ({
    value,
    label,
    bad,
}) => (
    <div
        className={`border-2 p-3 ${
            bad ? "border-retro-primary bg-retro-primary/10" : "border-black bg-white"
        }`}
    >
        <p className="text-3xl font-black tabular-nums tracking-tighter">{value}</p>
        <p className="mt-0.5 text-[11px] font-bold leading-snug text-black/50">
            {label}
        </p>
    </div>
);

/* ────────────────────────────────────────────────────────────────────────────
   자료 — 코드에서 세어 온 값들
   ──────────────────────────────────────────────────────────────────────────── */

/** `src/index.css` 의 `@theme` 실제 값과 funky-ui accent 이름의 대응 */
const PALETTE: {
    token: string;
    hex: string;
    funky: string;
    uses: number;
    note?: string;
}[] = [
    { token: "retro-primary", hex: "#ff4eba", funky: "pink", uses: 54 },
    { token: "retro-accent3", hex: "#ff4eba", funky: "pink", uses: 3, note: "primary 와 같은 값" },
    { token: "retro-secondary", hex: "#7828c8", funky: "purple", uses: 13 },
    { token: "retro-accent1", hex: "#3decfd", funky: "cyan", uses: 9 },
    { token: "retro-accent2", hex: "#ffd500", funky: "yellow", uses: 2 },
    { token: "retro-accent4", hex: "#ff9100", funky: "orange", uses: 35 },
    { token: "retro-accent5", hex: "#00c8ff", funky: "sky", uses: 24 },
    { token: "retro-green", hex: "#00c22a", funky: "green", uses: 48 },
    { token: "retro-bg", hex: "#fff5d1", funky: "bg", uses: 9 },
    { token: "retro-fg", hex: "#222222", funky: "ink", uses: 1 },
    { token: "retro-accent-light", hex: "#f0fdff", funky: "accentSoft", uses: 13 },
    { token: "(없음)", hex: "#ff3b3b", funky: "red", uses: 0, note: "funky 에만 있는 8번째" },
];

/** 코드에 실제로 등장하는 그림자 값 — 가이드는 두 개라고 적고 있습니다 */
const SHADOWS: { cls: string; count: number }[] = [
    { cls: "shadow-[2px_2px_0_0_rgba(0,0,0,0.05)]", count: 1 },
    { cls: "shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]", count: 2 },
    { cls: "shadow-[3px_3px_0_0_rgba(0,0,0,0.1)]", count: 2 },
    { cls: "shadow-[3px_3px_0_0_rgba(0,0,0,0.2)]", count: 6 },
    { cls: "shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]", count: 9 },
    { cls: "shadow-[4px_4px_0_0_rgba(0,0,0,0.15)]", count: 2 },
    { cls: "shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]", count: 22 },
    { cls: "shadow-[6px_6px_0_0_rgba(0,0,0,0.1)]", count: 1 },
    { cls: "shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]", count: 21 },
    { cls: "shadow-[8px_8px_0_0_rgba(0,0,0,0.2)]", count: 1 },
    { cls: "shadow-[8px_8px_0_0_rgba(0,0,0,0.3)]", count: 1 },
    { cls: "shadow-[4px_4px_0_0_rgba(255,165,0,0.4)]", count: 1 },
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
                Design Inventory
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-tighter md:text-4xl">
                class-explorer 컴포넌트 표본집
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-relaxed text-black/50">
                funky-ui 토큰 구조를 다시 잡기 전에, 지금 이 앱이 실제로 그리고 있는
                것들을 종류별로 늘어놓았습니다. 표본은 전부 코드에서 그대로 옮겼고
                옆에 원본 위치를 달아 두었습니다. 개발 환경에서만 열립니다.
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
                    있습니다.
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Figure value="76" label="원시 <button> — 직접 그린 것" bad />
                <Figure value="26" label="RetroButton — 공식 atom 을 쓴 것" />
                <Figure value="31" label="서로 다른 버튼 아키타입" bad />
                <Figure value="8" label="그중 하드 그림자를 가진 것 (정체성)" bad />
                <Figure value="12" label="코드에 존재하는 그림자 값 (가이드는 2)" bad />
                <Figure value="41" label="isSelected — 가장 많이 쓰인 축" />
                <Figure value="4→1" label="variant 4종 중 실제로 쓰인 것은 black 뿐" bad />
                <Figure value="0" label="primary·secondary variant 사용처" bad />
            </div>
        </section>

        {/* ── 공식 Atom ──────────────────────────────────────────────────── */}
        <Section
            id="atom"
            title="공식 Atom — RetroButton"
            lead="API 가 제공하는 전부입니다. variant 4종 × size 3종 × isSelected 불리언."
        >
            <Spec
                name="variant"
                src="atoms/RetroButton.tsx"
                note="secondary 는 코드에서 어떤 분기도 타지 않습니다 — white 와 완전히 같게 그려지는 죽은 값입니다. primary·secondary 는 앱 전체에서 사용처가 0입니다."
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
                name="size"
                src="atoms/RetroButton.tsx"
                note="sm 29회 · lg 3회 · md 1회. 실제로는 sm 이 기본값처럼 쓰이는데 API 기본값은 md 입니다."
            >
                <RetroButton size="sm">sm</RetroButton>
                <RetroButton size="md">md</RetroButton>
                <RetroButton size="lg">lg</RetroButton>
            </Spec>

            <Spec
                name="isSelected"
                src="atoms/RetroButton.tsx"
                note="가장 많이 쓰이는 축(41회)인데 색 축이 아니라 불리언으로 얹혀 있습니다. 켜지면 variant 를 통째로 덮어써서 어떤 색이든 검정이 됩니다."
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
                src="atoms/RetroButton.tsx"
                note="아이콘 전용 버튼을 위한 자리는 없습니다. 그래서 앱 안의 아이콘 버튼 12개가 전부 원시 button 입니다."
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
            lead="TradePage 가 색마다 진한 면(solid)과 옅은 면(soft)을 짝지어 쓰고 있습니다. 축이 없어서 자리마다 직접 적었을 뿐, 사실상 color × variant 를 재발명한 것입니다."
        >
            <Spec
                name="green — solid / soft"
                src="pages/TradePage.tsx:858"
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
                src="pages/TradePage.tsx:878"
                note="충돌하는 분반. soft 쪽은 /25 알파를 씁니다 — green 의 soft 는 white/50, 여기는 accent4/25 로 방식이 다릅니다."
            >
                <button className="border-2 border-retro-accent4 bg-retro-accent4 px-2 py-1 text-[10px] font-black text-black transition-all duration-100">
                    3분반
                </button>
                <button className="border-2 border-retro-accent4 bg-retro-accent4/25 px-2 py-1 text-[10px] font-black transition-all duration-100">
                    3분반
                </button>
            </Spec>

            <Spec
                name="sky — solid / soft"
                src="pages/TradePage.tsx:1091"
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
                src="pages/TradePage.tsx:1063 · 1150"
                note="드랍. solid 는 글자가 흰색, 다른 색들은 검정입니다 — 면 위 글자색이 색마다 손으로 결정돼 있습니다."
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
                src="pages/TradePage.tsx:1301"
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
                src="pages/TradePage.tsx:1346"
                note="disabled 가 아니라 '누를 수는 있지만 권하지 않는' 상태입니다. 표준 disabled 스타일(opacity-25·40·50 이 자리마다 다름)과 별개로 존재합니다."
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
                src="pages/AdminPage.tsx:79 · SearchPage.tsx:83"
                note="border-black/30 → hover 에 border-black. 앱에서 가장 흔한 버튼 모양인데 atom 에는 없습니다."
            >
                <button className="border-2 border-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black/40 transition-all duration-100 hover:border-black hover:text-black">
                    세션 종료
                </button>
                <button className="flex items-center gap-2 border-2 border-black/30 px-3 py-2 text-xs font-black uppercase text-black/50 transition-all duration-100 hover:border-black hover:text-black">
                    <Search size={14} strokeWidth={3} />
                    검색 도움말
                </button>
            </Spec>

            <Spec
                name="solid black"
                src="pages/AdminPage.tsx:369 · RequestSidebar.tsx:95"
                note="확정 동작. hover 가 bg-black/80 인 곳과 아무것도 없는 곳이 섞여 있습니다."
            >
                <button className="border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase text-white transition-all duration-100 hover:bg-black/80">
                    만들기
                </button>
                <button className="flex items-center justify-center gap-1 border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40">
                    허용
                </button>
            </Spec>

            <Spec
                name="white + 하드 그림자 (정체성)"
                src="components/SearchResultDisplay.tsx:700"
                note="76개 중 이 눌림 피드백을 가진 건 8개뿐입니다. 시스템의 시그니처인데 실제로는 예외에 가깝습니다."
            >
                <button className="flex items-center gap-3 border-2 border-black bg-white px-10 py-4 text-lg font-black uppercase tracking-tighter shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] transition-colors hover:bg-retro-accent-light active:translate-x-0.5 active:translate-y-0.5 active:shadow-none">
                    전체 보기
                    <ArrowRight size={18} strokeWidth={3} />
                </button>
            </Spec>

            <Spec
                name="translucent (어두운 배경 위)"
                src="components/Navigation.tsx:54 · TermSwitcher.tsx:47"
                note="네비게이션이 검정이라 흰색 알파로 그립니다. 밝은 배경용과 어두운 배경용이 다른 컴포넌트로 갈라져 있습니다."
            >
                <div className="flex flex-wrap items-center gap-2 bg-retro-secondary p-2">
                    <button className="flex items-center gap-2 border-2 border-white/30 bg-white/10 px-3 py-1.5 text-white transition-all duration-100 hover:border-white hover:bg-white/20">
                        <span className="text-xs font-black uppercase">2026-2</span>
                    </button>
                    <button className="border-2 border-white/30 bg-white/10 px-3 py-1.5 text-xs font-black uppercase text-white transition-all duration-100 hover:border-white hover:bg-white/20">
                        로그아웃
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
                src="pages/CalendarPage.tsx:229"
                note="평소 흰 면, hover 에 통째로 검정. 아이콘 버튼에서만 쓰이는 또 하나의 방식입니다."
            >
                <button className="border-2 border-black bg-white p-1.5 transition-all duration-100 hover:bg-black hover:text-white">
                    <ChevronLeft size={16} strokeWidth={3} />
                </button>
                <button className="border-2 border-black bg-white p-1 transition-all duration-100 hover:bg-retro-accent-light active:scale-95 disabled:opacity-25">
                    <ChevronLeft size={16} strokeWidth={3} />
                </button>
            </Spec>
        </Section>

        {/* ── 아이콘·텍스트 ──────────────────────────────────────────────── */}
        <Section
            id="icon"
            title="아이콘 전용 · 텍스트형"
            lead="테두리도 배경도 없는 무리가 25개로 가장 많습니다. atom 으로는 전혀 표현할 수 없는 종류입니다."
        >
            <Spec
                name="아이콘만 (ghost)"
                src="FriendsManager.tsx:196 · AdminPage.tsx:414 · CalendarPage.tsx:358"
                note="색이 자리마다 다릅니다 — black/25, red-500, green-600. red-500·green-600 은 Tailwind 기본 팔레트로, retro 토큰 바깥입니다."
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
                src="molecules/BarChartRow.tsx:61 · FilterSection.tsx:47"
                note="밑줄이 붙는 것과 안 붙는 것, hover 색이 primary 인 것과 black 인 것이 섞여 있습니다."
            >
                <button className="text-xs font-black uppercase transition-all hover:text-retro-primary hover:underline hover:decoration-2 hover:underline-offset-4">
                    미적분학1
                </button>
                <button className="text-xs font-black uppercase underline transition-colors hover:text-retro-primary">
                    전체 해제
                </button>
                <button className="flex items-center gap-1.5 text-xs font-black uppercase transition-colors hover:text-retro-primary">
                    <RefreshCw size={12} strokeWidth={3} />
                    새로고침
                </button>
            </Spec>

            <Spec
                name="목록 행 (전체가 버튼)"
                src="SearchResultDisplay.tsx:304 · AnalysisPage.tsx:464"
                note="왼쪽 굵은 선이 hover 에 진해집니다. 버튼이라기보다 선택 가능한 행인데 button 으로 그려져 있습니다."
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
            lead="같은 뜻(고른 것 = 검정)을 네 곳에서 각각 적었습니다. isSelected 가 41번 쓰인 이유이기도 합니다."
        >
            <Spec
                name="pill"
                src="components/EventFormModal.tsx:116"
                note="pill(active) 헬퍼로 파일 안에서만 재사용됩니다 — 컴포넌트가 아니라 문자열 함수입니다."
            >
                <button className="border-2 border-black bg-black px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white transition-all duration-100">
                    종일
                </button>
                <button className="border-2 border-black/30 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-black/40 transition-all duration-100 hover:border-black hover:text-black">
                    시각
                </button>
                <button className="border-2 border-black/30 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-black/40 transition-all duration-100 hover:border-black hover:text-black">
                    교시
                </button>
            </Spec>

            <Spec
                name="segment (붙은 버튼들)"
                src="pages/AdminPage.tsx:401"
                note="-ml-0.5 로 테두리를 겹치고 선택된 것에 z-10 을 줍니다. 그룹 개념이 없어 자리마다 손으로 겹칩니다."
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
                src="components/SearchResultDisplay.tsx:480"
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
                name="사이드바 항목"
                src="components/Sidebar.tsx:14 · BottomNav.tsx:14"
                note="선택 시 하드 그림자가 생기고 hover 에 사라집니다. 다른 선택 UI 는 그림자를 쓰지 않습니다."
            >
                <div className="w-full space-y-1">
                    <button className="flex w-full items-center gap-3 border-2 border-black bg-black px-4 py-3 font-black uppercase text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
                        <Search size={16} strokeWidth={3} />
                        Search
                    </button>
                    <button className="flex w-full items-center gap-3 border-2 border-transparent px-4 py-3 font-black uppercase text-black/60 transition-all duration-100 hover:text-black">
                        <Plus size={16} strokeWidth={3} />
                        Browse
                    </button>
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
            lead="17개 input · 3개 select · 1개 textarea. 공통 atom 은 SearchInput 하나뿐이고 나머지는 자리마다 직접 그렸습니다."
        >
            <Spec
                name="SearchInput — 유일한 공식 인풋"
                src="atoms/SearchInput.tsx"
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
                            className="w-full border-2 border-black bg-white py-2 pl-10 pr-3 text-sm font-bold placeholder:text-black/20 focus:outline-none"
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
                            className="w-full border-2 border-black bg-white py-4 pl-12 pr-4 text-lg font-bold placeholder:text-black/20 focus:outline-none"
                        />
                    </div>
                </div>
            </Spec>

            <Spec
                name="폼 인풋 (손으로 그린 것)"
                src="EventFormModal.tsx · AdminPage.tsx · LoginPage.tsx"
                note="border-2 border-black + focus 처리가 자리마다 다릅니다. focus 링 규칙이 시스템에 없습니다."
            >
                <div className="w-full space-y-2">
                    <input
                        readOnly
                        placeholder="제목"
                        className="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold placeholder:text-black/20 focus:outline-none"
                    />
                    <input
                        readOnly
                        type="date"
                        className="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold focus:outline-none"
                    />
                    <select className="w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold focus:outline-none">
                        <option>개인 일정</option>
                    </select>
                    <textarea
                        readOnly
                        placeholder="메모"
                        rows={2}
                        className="w-full resize-none border-2 border-black bg-white px-3 py-2 text-sm font-bold placeholder:text-black/20 focus:outline-none"
                    />
                </div>
            </Spec>

            <Spec
                name="체크박스"
                src="EventFormModal.tsx · ZamongPage.tsx"
                note="브라우저 기본 체크박스입니다 — 유일하게 둥근 모서리가 남아 있는 자리입니다."
            >
                <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" defaultChecked className="h-4 w-4" />
                    반복
                </label>
            </Spec>

            <Spec
                name="disabled"
                src="여러 곳"
                note="opacity 값이 25·30·40·50 네 가지로 흩어져 있습니다."
            >
                <button className="border-2 border-black bg-white p-1 opacity-25" disabled>
                    <ChevronLeft size={16} strokeWidth={3} />
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
                    design-guide.md 는 두 개(4px·6px)라고 적고 있는데 코드에는 12개가
                    있습니다. 오프셋 5단 × 투명도 5단이 뒤섞였습니다.
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
                    — 옮길 때 색을 새로 고를 필요가 없다는 뜻입니다.
                </p>
            </div>
            <div className="overflow-x-auto border-2 border-black bg-white">
                <table className="w-full min-w-[640px] text-left">
                    <thead className="border-b-2 border-black bg-retro-bg">
                        <tr className="text-[10px] font-black uppercase tracking-widest">
                            <th className="p-2.5">색</th>
                            <th className="p-2.5">class-explorer</th>
                            <th className="p-2.5">hex</th>
                            <th className="p-2.5">funky-ui</th>
                            <th className="p-2.5 text-right">사용</th>
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
                                <td className="p-2.5 text-black/40">{c.note ?? ""}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Spec
                    name="가이드와 코드가 어긋난 자리"
                    src="design-guide.md ↔ index.css"
                    note="design-guide.md 의 색 표는 지금 코드와 다릅니다 — retro-primary 를 #ff3e3e(빨강)로, retro-bg 를 #f8f5f0 으로, retro-fg 를 #000000 으로 적고 있습니다. 실제 값은 각각 #ff4eba·#fff5d1·#222222 입니다."
                >
                    <div className="flex gap-2">
                        <div className="border-2 border-black">
                            <div
                                className="h-10 w-20"
                                style={{ backgroundColor: "#ff3e3e" }}
                            />
                            <p className="border-t-2 border-black px-1 py-0.5 text-center font-mono text-[9px]">
                                가이드
                            </p>
                        </div>
                        <div className="border-2 border-black">
                            <div
                                className="h-10 w-20"
                                style={{ backgroundColor: "#ff4eba" }}
                            />
                            <p className="border-t-2 border-black px-1 py-0.5 text-center font-mono text-[9px]">
                                실제
                            </p>
                        </div>
                    </div>
                </Spec>
                <Spec
                    name="토큰 바깥 색"
                    src="AdminPage.tsx · GoogleLoginButton.tsx"
                    note="Tailwind 기본 팔레트(red-500·green-600)와 구글 브랜드 색이 토큰을 우회해 들어와 있습니다. 하드코딩 hex 는 22곳입니다."
                >
                    <span className="border-2 border-black bg-red-500 px-2 py-1 text-[10px] font-black text-white">
                        red-500
                    </span>
                    <span className="border-2 border-black bg-green-600 px-2 py-1 text-[10px] font-black text-white">
                        green-600
                    </span>
                    <span className="border-2 border-black px-2 py-1 text-[10px] font-black text-white" style={{ backgroundColor: "#4285F4" }}>
                        #4285F4
                    </span>
                </Spec>
            </div>
        </section>

        {/* ── 배지·피드백 ────────────────────────────────────────────────── */}
        <Section
            id="misc"
            title="배지 · 피드백"
            lead="버튼 바깥의 작은 것들. 여기도 같은 문제가 반복됩니다."
        >
            <Spec
                name="StudentBadge"
                src="atoms/StudentBadge.tsx"
                note="학번 앞 두 자리로 색이 정해집니다. 색 + 알파 면 + 색 글자 — 위에서 본 soft 변형과 같은 구조인데 따로 구현돼 있습니다."
            >
                <StudentBadge studentId="23-001" studentName="김" />
                <StudentBadge studentId="24-002" studentName="이" />
                <StudentBadge studentId="25-003" studentName="박" />
                <StudentBadge studentId="26-004" studentName="최" />
            </Spec>

            <Spec
                name="상태 배지"
                src="TradePage.tsx · CalendarPage.tsx"
                note="text-[10px] font-black uppercase tracking-widest 가 배지의 사실상 표준인데 규칙으로 적혀 있지 않습니다."
            >
                <span className="border-2 border-black bg-retro-green px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                    여유
                </span>
                <span className="border-2 border-retro-accent4 bg-retro-accent4/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                    충돌
                </span>
                <span className="border-2 border-black/20 bg-black/[0.03] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-black/40">
                    이수함
                </span>
            </Spec>

            <Spec
                name="RetroSpinner"
                src="atoms/RetroSpinner.tsx"
                note="paper-ui 에서 옮겨 왔습니다. funky-ui 에는 스피너가 없어서 생긴 일입니다 — 인벤토리가 찾아낸 첫 번째 구멍."
            >
                <RetroSpinner size="sm" />
                <RetroSpinner size="md" />
                <RetroSpinner size="lg" />
            </Spec>

            <Spec
                name="빈 상태"
                src="MealCard.tsx:150"
                note="No Data Found 한 줄. 빈 상태 컴포넌트가 따로 없어 자리마다 다르게 적혀 있습니다."
            >
                <div className="flex w-full items-center justify-center border-2 border-black/10 py-6">
                    <p className="text-xs font-black uppercase tracking-widest text-black/25">
                        No Data Found
                    </p>
                </div>
            </Spec>

            <Spec
                name="소제목"
                src="atoms/RetroSubTitle.tsx"
                note="이건 잘 지켜지는 축입니다 — 스타일이 고정돼 있고 우회 사례가 없습니다. 축을 좁게 잡으면 지켜진다는 반례."
            >
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-black/40">
                    <Search size={18} className="text-black/40" />
                    Meal
                </span>
            </Spec>
        </Section>
    </div>
);

export default InventoryPage;
