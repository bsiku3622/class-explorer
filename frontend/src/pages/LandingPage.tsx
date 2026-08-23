import React from "react";
import {
    ArrowRight,
    BookOpen,
    CalendarDays,
    GraduationCap,
    Home,
    Library,
    MapPin,
    Search,
    Shield,
    Smartphone,
    ArrowLeftRight,
    BarChart3,
} from "lucide-react";
import RetroCard from "../components/atoms/RetroCard";
import RetroButton from "../components/atoms/RetroButton";

/**
 * 로그인하지 않은 사람이 보는 **공개 소개 화면**.
 *
 * 이 앱은 계정이 있어야 쓸 수 있어서, 주소를 열면 곧장 로그인 창이 떴습니다. 그러면
 * 밖에서 보기에 이 주소에는 **아무 내용도 없습니다** — 검색 엔진도 로그인 폼만 봅니다.
 * 그래서 무엇을 하는 앱인지 설명하는 화면을 하나 두고, 로그인은 그다음 걸음으로
 * 미뤘습니다.
 *
 * ⚠️ **여기에는 실제 데이터가 한 줄도 들어가면 안 됩니다.** 로그인 앞에 있는 화면이라
 * 누구나 봅니다. 화면 예시에 쓰는 이름·과목·교실은 전부 지어낸 것이고, 앞으로도
 * 그래야 합니다 — 진짜를 넣으면 그 순간 명단이 공개됩니다.
 */

/* ── 반복해서 쓰는 조각들 ─────────────────────────────────────────────── */

const Kicker: React.FC<{ children: React.ReactNode; tone?: string }> = ({
    children,
    tone = "text-black/40",
}) => (
    <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${tone}`}>
        {children}
    </span>
);

const Section: React.FC<{
    children: React.ReactNode;
    className?: string;
    id?: string;
}> = ({ children, className = "", id }) => (
    <section id={id} className={`px-5 py-16 md:px-8 md:py-24 ${className}`}>
        <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
);

/** 기울인 큰 제목 — 이 앱의 로고와 같은 몸짓입니다 */
const Display: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = "",
}) => (
    <span
        className={`inline-block -skew-x-6 font-black uppercase leading-[0.95] tracking-tighter ${className}`}
    >
        {children}
    </span>
);

/* ── 히어로에 놓는 가짜 화면 ──────────────────────────────────────────────
   ⚠️ 여기 이름과 과목은 **전부 지어낸 것**입니다. 실제 명단을 넣지 마세요 */

const MockNow: React.FC = () => (
    <RetroCard shadow="lg" className="bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
            <Kicker>지금</Kicker>
            <span className="border-2 border-black bg-retro-primary px-1.5 py-0.5 text-[10px] font-black text-white">
                6–7교시
            </span>
        </div>
        <p className="mt-3 text-2xl font-black tracking-tight">일반물리학2</p>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] font-bold text-black/55">
            <MapPin size={13} strokeWidth={2.5} /> 형3204 · 2분반
        </p>
        <div className="mt-4 flex items-baseline justify-between text-[11px] font-black tabular-nums">
            <span className="text-black/40">14:40 – 16:30</span>
            <span>55분 남음</span>
        </div>
        <div className="mt-1.5 h-3 border-2 border-black bg-white">
            <div className="h-full bg-retro-primary" style={{ width: "48%" }} />
        </div>
        <div className="mt-4 flex items-center gap-2 border-t-2 border-black/10 pt-3 text-[11px] font-bold">
            <span className="text-black/35">다음</span>
            <span className="font-black">9교시 확률및통계</span>
            <span className="text-black/35">형3301</span>
        </div>
    </RetroCard>
);

const MockEmptyRooms: React.FC = () => (
    <RetroCard shadow="lg" className="bg-white p-5">
        <Kicker>비어 있는 교실</Kicker>
        <div className="mt-3 grid grid-cols-3 gap-2">
            {[
                ["형3202", true],
                ["형3203", true],
                ["형3204", false],
                ["형3205", true],
                ["형3206", false],
                ["형3207", true],
            ].map(([room, free]) => (
                <div
                    key={room as string}
                    className={`border-2 px-2 py-2 text-center text-[11px] font-black ${
                        free
                            ? "border-black bg-retro-accent1"
                            : "border-black/15 bg-black/[0.03] text-black/25"
                    }`}
                >
                    {room}
                </div>
            ))}
        </div>
    </RetroCard>
);

const MockSearch: React.FC = () => (
    <RetroCard shadow="lg" className="bg-white p-4">
        <div className="flex items-center gap-2 border-2 border-black px-3 py-2">
            <Search size={15} strokeWidth={2.5} className="shrink-0 text-black/40" />
            <span className="font-black">월1 &amp; 물리</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
            {["일반물리학1", "일반물리학실험1", "고급물리학"].map((s) => (
                <span
                    key={s}
                    className="border-2 border-black bg-retro-accent2 px-2 py-0.5 text-[11px] font-black"
                >
                    {s}
                </span>
            ))}
        </div>
    </RetroCard>
);

/* ── 본문 ──────────────────────────────────────────────────────────────── */

const PILLARS = [
    {
        n: "01",
        t: "검색창이 하나뿐입니다",
        d: "이름, 학번, 과목, 교실을 한 칸에 넣습니다. 월1 을 치면 월요일 1교시 수업이 전부 나오고, ㅁㅈㅂㅎ 처럼 초성만 쳐도 찾습니다.",
    },
    {
        n: "02",
        t: "홈은 지금부터 봅니다",
        d: "다음 수업까지 몇 분 남았고 어느 교실인지가 맨 위에 있습니다. 오늘 시간표와 급식은 그 아래.",
    },
    {
        n: "03",
        t: "지난 회차도 남아 있습니다",
        d: "받아 온 데이터를 덮어쓰지 않습니다. 분반이 언제 생겼고 교실이 언제 바뀌었는지 되돌려 볼 수 있습니다.",
    },
];

const FEATURES = [
    {
        icon: Search,
        title: "통합 검색",
        body: "이름도 과목도 교실도 같은 칸입니다. 여러 명을 한 번에 올려 시간표를 겹쳐 볼 수도 있습니다.",
        color: "bg-retro-accent1",
    },
    {
        icon: Home,
        title: "홈",
        body: "지금 몇 교시고 어디로 가야 하는지. 오늘 시간표와 급식도 같이 봅니다.",
        color: "bg-retro-accent2",
    },
    {
        icon: MapPin,
        title: "빈 강의실",
        body: "요일이랑 교시를 고르면 그때 비는 형설관 교실만 남습니다. 여러 교시를 한꺼번에 골라도 됩니다.",
        color: "bg-retro-primary",
    },
    {
        icon: BarChart3,
        title: "학사 통계",
        body: "과목별 수강 인원, 교사별 시수, 강의실 가동률.",
        color: "bg-retro-accent5",
    },
    {
        icon: GraduationCap,
        title: "졸업 요건",
        body: "들은 과목을 채워 두면 학점이 얼마나 남았는지 계산합니다. 쓰던 엑셀이 있으면 그대로 올려도 됩니다.",
        color: "bg-retro-green",
    },
    {
        icon: ArrowLeftRight,
        title: "수강 변경 탐색",
        body: "정정 기간에 뭘 빼고 뭘 넣을지 미리 그려 봅니다. 시간 겹치는 조합은 알아서 걸러 줍니다.",
        color: "bg-retro-accent4",
    },
    {
        icon: CalendarDays,
        title: "학사일정",
        body: "학사일정 위에 내 일정을 얹어 봅니다.",
        color: "bg-retro-secondary text-white",
    },
    {
        icon: Library,
        title: "교육과정",
        body: "뭘 먼저 들어야 하는지 선으로 이어 놨습니다.",
        color: "bg-white",
    },
];

const FAQ = [
    {
        q: "누가 쓸 수 있나요?",
        a: "한국과학영재학교 구성원이요. 계정은 관리자가 만들어 주고, 처음 들어오면 학교 구글 계정으로 학번을 한 번 확인합니다.",
    },
    {
        q: "시간표는 어디서 오나요?",
        a: "학교 학사 시스템에서 학기 단위로 받아 옵니다. 급식은 급식 시스템에서 따로 가져옵니다.",
    },
    {
        q: "로그인하지 않으면 무엇이 보이나요?",
        a: "이 화면이 전부입니다. 이름이나 시간표가 들어간 곳은 전부 로그인 뒤에 있습니다.",
    },
    {
        q: "폰에서도 되나요?",
        a: "웹 그대로 씁니다. 안드로이드는 지금 교시랑 급식을 홈 화면에 올리는 위젯이 따로 있습니다.",
    },
];

interface LandingPageProps {
    /** 로그인 화면으로 넘깁니다 */
    onStart: () => void;
    /** 개인정보처리방침으로 넘깁니다 */
    onPrivacy: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart, onPrivacy }) => (
    <div className="min-h-screen bg-retro-bg text-retro-fg">
        {/* ── 머리띠 ── */}
        <header className="border-b-2 border-black bg-retro-secondary">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 md:px-8">
                <span className="-skew-x-6 text-xl font-black uppercase tracking-tight text-white md:text-2xl">
                    Class Explorer
                </span>
                <RetroButton size="sm" onClick={onStart}>
                    로그인
                </RetroButton>
            </div>
        </header>

        {/* ── 히어로 ── */}
        <div className="border-b-2 border-black">
            <div className="mx-auto w-full max-w-5xl px-5 py-16 md:px-8 md:py-24">
                <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="flex flex-col gap-6">
                        <Kicker>한국과학영재학교 · 수업 탐색</Kicker>
                        <h1 className="text-5xl md:text-7xl">
                            <Display>시간표를</Display>
                            <br />
                            <Display className="text-retro-secondary">
                                검색합니다<span className="text-retro-primary">.</span>
                            </Display>
                        </h1>
                        <p className="max-w-xl text-[15px] font-bold leading-relaxed text-black/60 md:text-base">
                            이름을 넣으면 그 사람 시간표가, 교실을 넣으면 그 교실
                            일정이 나옵니다. 빈 강의실도, 친구가 언제 비는지도 여기서
                            찾습니다.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <RetroButton
                                variant="black"
                                onClick={onStart}
                                icon={<ArrowRight size={14} strokeWidth={3} />}
                            >
                                로그인
                            </RetroButton>
                            <a href="#features">
                                <RetroButton>기능 보기</RetroButton>
                            </a>
                        </div>
                        <p className="text-xs font-bold text-black/35">
                            계정은 학교 구성원에게만 발급됩니다.
                        </p>
                    </div>

                    {/* 좁은 화면에서는 한 장만. 기울인 콜라주는 자리가 있을 때만
                        폅니다 — 좁은 곳에서 겹치면 서로를 가립니다 */}
                    <div className="lg:hidden">
                        <MockNow />
                    </div>
                    <div className="relative hidden h-[26rem] lg:block">
                        <div className="absolute right-0 top-0 w-[17rem] rotate-3">
                            <MockNow />
                        </div>
                        <div className="absolute -left-6 top-[13rem] w-[15rem] -rotate-4">
                            <MockSearch />
                        </div>
                        <div className="absolute -right-4 bottom-0 w-[14rem] rotate-2">
                            <MockEmptyRooms />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* ── 세 가지 ── */}
        <section className="border-b-2 border-black bg-black px-5 py-16 text-white md:px-8 md:py-24">
            <div className="mx-auto w-full max-w-5xl">
                <Kicker tone="text-retro-accent2">이렇게 만들었습니다</Kicker>
                <div className="mt-8 grid gap-10 md:grid-cols-3">
                    {PILLARS.map((p) => (
                        <div key={p.n} className="flex flex-col gap-3">
                            <Display className="text-4xl text-retro-accent1">
                                {p.n}
                            </Display>
                            <h3 className="text-xl font-black tracking-tight">{p.t}</h3>
                            <p className="text-sm font-bold leading-relaxed text-white/65">
                                {p.d}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* ── 기능 ── */}
        <Section id="features" className="border-b-2 border-black">
            <Kicker>화면 여덟 개</Kicker>
            <h2 className="mt-3 text-3xl md:text-5xl">
                <Display>이런 걸 합니다.</Display>
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((f) => (
                    <RetroCard
                        key={f.title}
                        shadow="sm"
                        className="flex flex-col gap-3 bg-white p-5"
                    >
                        <span
                            className={`flex h-9 w-9 items-center justify-center border-2 border-black ${f.color}`}
                        >
                            <f.icon size={17} strokeWidth={2.5} />
                        </span>
                        <h3 className="text-lg font-black tracking-tight">{f.title}</h3>
                        <p className="text-[13px] font-bold leading-relaxed text-black/55">
                            {f.body}
                        </p>
                    </RetroCard>
                ))}
            </div>

            <RetroCard
                shadow="sm"
                className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 bg-retro-accent-light p-5"
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-black bg-white">
                    <Smartphone size={17} strokeWidth={2.5} />
                </span>
                <p className="min-w-0 flex-1 basis-64 text-[13px] font-bold leading-relaxed text-black/60">
                    <span className="font-black text-black">안드로이드 위젯</span> — 지금
                    교시랑 오늘 급식을 홈 화면에 올려 둡니다. 앱을 안 열어도 보입니다.
                </p>
            </RetroCard>
        </Section>

        {/* ── 데이터와 개인정보 ── */}
        <Section className="border-b-2 border-black bg-white">
            <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div>
                    <Kicker>데이터</Kicker>
                    <h2 className="mt-3 text-3xl md:text-4xl">
                        <Display>명단은 로그인</Display>
                        <br />
                        <Display>뒤에 있습니다.</Display>
                    </h2>
                </div>
                <div className="flex flex-col gap-5">
                    <div className="flex gap-3">
                        <Shield
                            size={18}
                            strokeWidth={2.5}
                            className="mt-0.5 shrink-0 text-retro-secondary"
                        />
                        <p className="text-sm font-bold leading-relaxed text-black/60">
                            <span className="font-black text-black">
                                로그인 전에는 이름 하나 안 나옵니다.
                            </span>{" "}
                            이 화면 밖은 전부 계정을 요구합니다. 계정은 관리자가 만들고,
                            학번은 학교 구글 계정으로 한 번 확인합니다.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <BookOpen
                            size={18}
                            strokeWidth={2.5}
                            className="mt-0.5 shrink-0 text-retro-secondary"
                        />
                        <p className="text-sm font-bold leading-relaxed text-black/60">
                            <span className="font-black text-black">
                                수업 데이터는 학교 학사 시스템에서 옵니다.
                            </span>{" "}
                            학기 단위로 받아 오고, 뭔가 바뀌었을 때만 회차를 올립니다.
                            급식은 급식 시스템에서 따로 가져옵니다.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <CalendarDays
                            size={18}
                            strokeWidth={2.5}
                            className="mt-0.5 shrink-0 text-retro-secondary"
                        />
                        <p className="text-sm font-bold leading-relaxed text-black/60">
                            <span className="font-black text-black">
                                친구 화면에는 과목명이 없습니다.
                            </span>{" "}
                            언제 비는지만 나옵니다. 남의 하루를 통째로 펼쳐 놓을 이유가
                            없어서요.
                        </p>
                    </div>
                </div>
            </div>
        </Section>

        {/* ── 자주 묻는 것 ── */}
        <Section className="border-b-2 border-black">
            <Kicker>자주 묻는 것</Kicker>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
                {FAQ.map((f) => (
                    <RetroCard key={f.q} shadow="sm" className="bg-white p-5">
                        <h3 className="text-base font-black tracking-tight">{f.q}</h3>
                        <p className="mt-2 text-[13px] font-bold leading-relaxed text-black/55">
                            {f.a}
                        </p>
                    </RetroCard>
                ))}
            </div>
        </Section>

        {/* ── 마지막 ── */}
        <section className="bg-retro-secondary px-5 py-20 text-white md:px-8 md:py-28">
            <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-7 text-center">
                <h2 className="text-4xl md:text-6xl">
                    <Display>이제 안 뒤져도</Display>
                    <br />
                    <Display className="text-retro-accent2">됩니다.</Display>
                </h2>
                {/* 이 구역은 글자가 흰색이라, 흰 버튼은 색을 되돌려 줘야 합니다 —
                    `variant="white"` 는 면만 칠하고 글자색은 물려받습니다 */}
                <RetroButton
                    variant="white"
                    className="text-black"
                    onClick={onStart}
                    icon={<ArrowRight size={14} strokeWidth={3} />}
                >
                    로그인
                </RetroButton>
            </div>
        </section>

        <footer className="border-t-2 border-black bg-black px-5 py-8 text-white md:px-8">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                    Class Explorer · KSA
                </span>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <button
                        onClick={onPrivacy}
                        className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 transition-colors duration-100 hover:text-white"
                    >
                        개인정보처리방침
                    </button>
                    <a
                        href="mailto:contact@bsiku.dev"
                        className="text-[11px] font-black tracking-[0.15em] text-white/40 transition-colors duration-100 hover:text-white"
                    >
                        contact@bsiku.dev
                    </a>
                    <a
                        href="https://github.com/bsiku3622/class-explorer"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 transition-colors duration-100 hover:text-white"
                    >
                        GitHub
                    </a>
                </div>
            </div>
        </footer>
    </div>
);

export default LandingPage;
