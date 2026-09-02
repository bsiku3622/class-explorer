/**
 * 홈 레이아웃 **버전 3** — "지금" 을 칸에서 꺼내 **머리로 올리고**, 그 자리에 자를
 * 되돌립니다.
 *
 * ```
 * ┌ 지금 (1fr) ─────────────────────────┬ 오늘 일정 (17rem) ─┐
 * │ 8월 18일 화요일             [3교시]  │ 개교기념일          │
 * │ 일반지구과학          ← 34px         │ 동아리 발표         │
 * │ 과학관 302 · 이도현 · 3분반           │                   │
 * │ ▓▓▓▓▓▓░░░░  11:20 까지 · 45분 남음   │                   │
 * │ NEXT  4교시 화학 · 본관 201 · 이동    │                   │
 * ├─────────────────────────────────────┴───────────────────┤
 * ┌ 오늘 (1fr) ─────────────────────────┬ 급식 (17rem) ─────┐
 * │ [자 DayRuler]                       │ 아침 점심 저녁     │
 * │ 목록 (스크롤)                        │ 아비꼬함박…        │
 * └─────────────────────────────────────┴──────────────────┘
 * ```
 *
 * **V2 가 평평했던 이유는 폭이 아니라 면적입니다.** 세 칸(지금·수업·급식)이 같은
 * 높이로 나란히 서면 폭을 아무리 달리 줘도 셋이 같은 무게로 읽힙니다 — 주인공에게
 * 폭을 준 게 아니라 **셋으로 나눈 것**이 문제였습니다. 여기서는 행을 둘로 갈라
 * 위(지금)와 아래(하루)의 크기를 다르게 둡니다.
 *
 * **자(`DayRuler`)가 돌아왔습니다.** V2 에서 사라진 건 자리가 없어서였는데, "지금" 이
 * 위로 올라가며 아래 칸이 통째로 비었습니다. 목록은 "다음이 뭐지" 에 답하고 자는
 * "오늘이 어떤 모양이지" 에 답합니다 — 둘은 서로를 대신하지 못합니다.
 *
 * **히어로를 다시 세운 근거.** 한때 "지금 무슨 수업" 을 큰 글씨로 외치는 카드를 뒀다가
 * 뺐습니다 — 바로 아래 핑크 줄이 글자까지 같은 말을 하고 있었기 때문입니다. 그때
 * 남긴 부활 조건이 **"목록이 못 하는 말을 시켜라"** 였고, 여기서는 셋을 시킵니다:
 * **남은 시간**(진행바), **다음 수업**, **교실 이동 여부**. 목록의 줄은 시각과 이름만
 * 알지, 지금 45분이 남았다는 것도 다음 교시에 건물을 옮겨야 한다는 것도 모릅니다.
 *
 * ⚠️ **카드는 둘이고 그 이상 늘리지 마세요.** 위 행(지금·일정)과 아래 행(하루·급식)
 * 까지가 한 화면에 들어오는 한계입니다 — 셋이 되면 주간 격자가 스크롤 밖으로 밀려
 * 나가고, 그러면 위에서 아낀 세로가 아무 의미가 없습니다.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    ArrowRight,
    CalendarDays,
    CalendarOff,
    ChevronLeft,
    ChevronRight,
    Footprints,
    LocateFixed,
    MapPin,
} from "lucide-react";
import type { HomeData } from "../../lib/friendsApi";
import {
    dateLabel,
    dayBlocks,
    deriveHomeView,
    duration,
    periodLabel as periodsLabel,
} from "../../lib/homeView";
import { getDepartmentColor, getKoreanName, hhmm } from "../../lib/utils";
import { CATEGORY_STYLE, timeLabel } from "../../lib/calendar";
import RetroCard from "../atoms/RetroCard";
import RetroSubTitle from "../atoms/RetroSubTitle";
import DayRuler from "../DayRuler";
import MealCard from "../MealCard";
import TodayTimeline from "../TodayTimeline";
import WeekTimetable from "./WeekTimetable";
import VacationBar from "../VacationBar";

/** 일정 칸이 히어로보다 길어지면 행의 주인공이 뒤바뀝니다 */
const EVENT_LIMIT = 5;

interface TodayCardV3Props {
    home: HomeData;
    liveMinute: number;
    quip: string | null;
    /**
     * 지금 그리는 게 **등록된 시간표가 아니라 트레이드 계획**인가 (`HomePage`).
     * 켜지면 히어로와 주간 격자에 표식이 붙습니다 — 이 화면은 "지금 어디로 가야
     * 하나" 에 답하는 자리라, 계획을 실제로 오해하면 엉뚱한 교실로 갑니다.
     */
    planned?: boolean;
}

const TodayCardV3: React.FC<TodayCardV3Props> = ({
    home,
    liveMinute,
    quip,
    planned = false,
}) => {
    const { now, session, today, events, meal } = home;
    const periods = home.periods ?? [];
    const breaks = home.breaks ?? [];
    const {
        isSchoolDay,
        livePeriod,
        breakKind,
        current,
        currentPeriods,
        next,
        periodLabel,
        freeMinutes,
    } = deriveHomeView(home, liveMinute);

    /**
     * 지금 수업의 시작·끝 — **연강이면 덩어리 전체**입니다.
     *
     * ⚠️ 교시 하나만 보면 10–11교시 생활음악이 20:20 에 끝난다고 말하면서 바로 아래
     * NEXT 에 **같은 과목을 또** 겁니다. 남은 시간·진행바·시각 범위가 전부 여기서
     * 나오므로 한 곳에서 덩어리로 잡습니다.
     */
    const blockStart =
        currentPeriods.length > 0
            ? (periods.find((p) => p.period === currentPeriods[0]) ?? null)
            : null;
    const blockEnd =
        currentPeriods.length > 0
            ? (periods.find(
                  (p) => p.period === currentPeriods[currentPeriods.length - 1],
              ) ?? null)
            : null;
    const nextStart = next
        ? (periods.find((p) => p.period === next.period)?.start_minute ?? null)
        : null;

    const untilNext = nextStart !== null ? nextStart - liveMinute : null;

    const boxRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLLIElement>(null);
    /** 지금 → 다음 → 마지막. 하루가 끝났는데 1교시를 보여 주면 오늘이 안 보입니다 */
    const focusPeriod =
        livePeriod ?? next?.period ?? today[today.length - 1]?.period ?? null;
    const hasTimetable = today.length > 0;
    const hasEvents = events.length > 0;

    /* ── 앞뒤로 넘겨 보기 ────────────────────────────────────────────────
       히어로는 "지금" 을 말하는 자리지만, 하루 전체를 같은 얼굴로 훑고 싶을 때가
       있습니다. 화살표를 누르면 **카드 전체**가 그 수업이 되고, `지금으로` 가 돌아옵니다.
       ⚠️ 넘겨 보는 중에는 이 카드가 현재를 말하지 않으므로, 그 사실이 화면에
       드러나야 합니다 — 뱃지가 핑크를 잃고 `지금으로` 가 나타나는 것이 그 신호입니다 */

    /** 오늘 수업을 연강 단위로. 화살표가 넘기는 단위입니다 */
    const blocks = useMemo(() => dayBlocks(home), [home]);

    /** 지금 덩어리가 몇 번째인가. 수업 중이 아니면 `-1` */
    const liveIndex = currentPeriods.length
        ? blocks.findIndex((b) => b.periods[0] === currentPeriods[0])
        : -1;

    /** null 이면 "지금" 을 그립니다 */
    const [browseIndex, setBrowseIndex] = useState<number | null>(null);

    /**
     * 응답이 갈리면 **넘겨 보던 것을 접습니다** — 몇 번째냐만 들고 있어서, 목록이
     * 달라지면 같은 번째가 다른 수업입니다.
     *
     * ⚠️ 날짜만 보면 모자랍니다. 계획↔기존 전환·깨어난 뒤 재요청·회차 변경이 전부
     * 목록을 바꾸는데 날짜는 그대로입니다. `home` 은 그 넷이 있을 때만 새로 만들어지고
     * (15초 시계 틱에는 안 바뀝니다) 그래서 이것을 그대로 신호로 씁니다.
     *
     * 효과가 아니라 렌더 중에 맞추는 이유는, 효과로 두면 한 번은 **옛 수업이 그려진
     * 뒤에** 지워져서 화면이 깜빡이기 때문입니다 (React 가 권하는 방식이기도 합니다).
     */
    const [browsedHome, setBrowsedHome] = useState(home);
    if (browsedHome !== home) {
        setBrowsedHome(home);
        setBrowseIndex(null);
    }

    const browsing = browseIndex === null ? null : (blocks[browseIndex] ?? null);

    /**
     * 화살표의 출발점. 수업 중이면 지금 덩어리, 공강·일과 종료면 **다음 수업 직전**을
     * 가리켜서 `›` 한 번에 다음 수업이 나오게 합니다.
     */
    const anchorIndex =
        liveIndex >= 0
            ? liveIndex
            : next
              ? blocks.findIndex((b) => b.periods.includes(next.period)) - 1
              : blocks.length - 1;
    const cursor = browseIndex ?? anchorIndex;

    const step = (delta: number) => {
        const to = cursor + delta;
        if (to < 0 || to >= blocks.length) return;
        setBrowseIndex(to === liveIndex ? null : to);
    };

    /** 카드가 지금 말하는 수업 — 넘겨 보는 중이면 그 덩어리입니다 */
    const shown = browsing ? browsing.klass : current;
    const shownStart = browsing ? browsing.start : blockStart;
    const shownEnd = browsing ? browsing.end : blockEnd;
    const shownNext = browsing
        ? (blocks[browseIndex! + 1]?.klass ?? null)
        : next;
    const shownNextStart = browsing
        ? (blocks[browseIndex! + 1]?.start.start_minute ?? null)
        : nextStart;
    /**
     * 교실이 다르면 쉬는시간에 **걸어야 합니다.** 목록은 교실을 줄마다 적어 두지만
     * 두 줄을 비교해 주지는 않습니다 — 히어로가 대신 봐 주는 말입니다.
     */
    const shownMoving = Boolean(shown && shownNext && shown.room !== shownNext.room);

    /**
     * 진행바 옆 글자. 지난 수업은 "이미 끝남", 아직 안 온 수업은 "n분 뒤" 입니다 —
     * 지난 수업에 "0분 남음" 을 적으면 지금 끝난 것처럼 읽힙니다.
     */
    const shownRemain = (() => {
        if (!shownStart || !shownEnd) return null;
        if (liveMinute >= shownEnd.end_minute) return "이미 끝남";
        if (liveMinute < shownStart.start_minute)
            return `${duration(shownStart.start_minute - liveMinute)} 뒤`;
        return `${duration(Math.max(0, shownEnd.end_minute - liveMinute))} 남음`;
    })();

    /**
     * 지금 줄을 상자 가운데로. **스크롤 상자만** 움직입니다 — `scrollIntoView` 는
     * 페이지까지 끌고 내려갑니다. 높이가 아직 0 이면 실패를 알리고 물러납니다.
     */
    const placeNow = useCallback((smooth: boolean) => {
        const box = boxRef.current;
        const row = rowRef.current;
        if (!box || !row || box.clientHeight === 0) return false;
        box.scrollTo({
            top: row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2,
            behavior: smooth ? "smooth" : "auto",
        });
        return true;
    }, []);

    /**
     * **처음 한 번만 맞춥니다.**
     *
     * ⚠️ 예전에는 `focusPeriod` 가 바뀔 때마다 다시 맞췄는데, 그러면 목록을 위로 밀어
     * 놓고 읽는 동안 교시가 넘어가면 화면이 제멋대로 돌아갑니다. 스크롤은 사용자가
     * 마지막으로 정한 자리이므로 앱이 되돌리면 안 됩니다 — 돌아가고 싶으면 머리의
     * `지금` 을 누릅니다.
     *
     * 날짜가 넘어가거나 계획↔기존을 갈아 끼우면 목록이 통째로 다른 하루라서 그때는
     * 다시 맞춥니다. `rAF` 는 높이가 잡히기 전에 재면 0 이 나와서입니다.
     */
    const placedFor = useRef<string | null>(null);
    const placeKey = `${home.now.date}:${planned ? "plan" : "real"}`;

    useLayoutEffect(() => {
        if (!hasTimetable || placedFor.current === placeKey) return;
        if (placeNow(false)) {
            placedFor.current = placeKey;
            return;
        }
        const frame = requestAnimationFrame(() => {
            if (placeNow(false)) placedFor.current = placeKey;
        });
        return () => cancelAnimationFrame(frame);
    }, [hasTimetable, placeKey, placeNow]);

    /**
     * 큰 글씨 한 줄 — 수업 중이면 과목명, 아니면 지금이 무슨 상태인지.
     *
     * ⚠️ **쉬는시간에 "쉬는시간" 이라고 쓰지 않습니다.** 그건 시각표가 이미 아는
     * 사실이고, 이 자리는 **지금 뭘 해야 하는지**를 묻는 자리입니다 — 다음 교시에
     * 수업이 있으면 `이동`, 없으면 `공강` (`breakKind`, `homeView.ts`).
     *
     * 연강 사이 10분은 `current` 가 살아 있어서 여기까지 오지도 않습니다 — 그 10분은
     * 수업이 끝난 게 아니고, 교실이 같아 옮길 데도 없습니다.
     */
    const headline = current
        ? getKoreanName(current.subject)
        : !isSchoolDay
          ? (session.off_label ?? "휴일")
          : today.length === 0
            ? "수업 없는 날"
            : !next
              ? "일과 종료"
              : (now.break_name ?? breakKind);

    return (
        <div className="flex flex-col gap-4 md:gap-5">
            {/* ══ 위 행 — 지금 ══════════════════════════════════════
                일정이 없는 날은 2열로 나누지 않습니다. 빈 17rem 을 남기면 히어로가
                이유 없이 좁아집니다 */}
            {/* ⚠️ **급식은 여기, 오늘 카드가 아닙니다.** 아래로 내려두면 하루를 훑는
                물건(자·목록) 사이에 끼어 흐름이 끊깁니다 — 급식은 "지금 몇 교시" 와
                같은 층의 **상태 정보**라 머리에 붙습니다 */}
            <RetroCard
                className={`grid overflow-hidden bg-white ${
                    hasEvents
                        ? "lg:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_16rem_17rem]"
                        : "lg:grid-cols-[minmax(0,1fr)_17rem]"
                }`}
            >
                {/* 왼쪽 학과색 띠 — 자·목록·주간 격자와 같은 색입니다. 수업이 없을
                    때도 **자리는 남깁니다**(`transparent`) — 색만 빼면 공강일 때 본문이
                    6px 왼쪽으로 밀려서, 1분마다 새로 받는 화면이 흔들려 보입니다 */}
                <div
                    className="flex min-w-0 flex-col border-l-[6px] p-5 md:p-6"
                    style={{
                        borderLeftColor: shown
                            ? getDepartmentColor(shown.department)
                            : "transparent",
                    }}
                >
                    <div className="flex items-baseline justify-between gap-3">
                        {/* `font-black` + `tracking-wide` 로 두니 11px 인데도 제목과
                            경쟁했습니다 — 이 줄은 **언제인지만** 알려 주면 됩니다 */}
                        <span className="flex min-w-0 items-baseline gap-2">
                            {/* 아래 `창5702 · 정현우 · 1분반` 줄과 **같은 글씨**입니다 —
                                히어로 안에서 부연은 한 크기로 통일합니다 */}
                            <span className="truncate text-[13px] font-bold text-black/45">
                                {dateLabel(now.date)}
                            </span>
                            {/* 계획을 보는 중이라는 말은 **날짜 옆**에 붙습니다 —
                                이 줄이 "언제·무엇을 보고 있는가" 를 말하는 자리입니다.
                                색은 Trade 와 같은 시안입니다 (`design-guide.md`) */}
                            {planned && (
                                <span className="shrink-0 border-2 border-black bg-retro-accent1 px-1.5 py-0.5 text-[10px] font-black">
                                    계획 미리보기
                                </span>
                            )}
                        </span>
                        {/* 시계는 두지 않습니다 — 이 화면의 단위는 교시이고, 시각은
                            아래 목록의 줄마다 이미 붙어 있습니다 */}
                        {/* ⚠️ **핑크는 "지금" 이라는 뜻입니다.** 앞뒤로 넘겨 보는
                            중이면 그 칠을 빼야 합니다 — 안 그러면 지난 수업을 보면서
                            지금이라고 읽습니다 */}
                        {(browsing ? true : periodLabel) && (
                            <span
                                className={`shrink-0 text-[11px] font-black ${
                                    current && !browsing
                                        ? "border-2 border-black bg-retro-primary px-1.5 py-0.5"
                                        : "text-black/40"
                                }`}
                            >
                                {browsing
                                    ? periodsLabel(browsing.periods)
                                    : periodLabel}
                            </span>
                        )}
                    </div>

                    {/* ── 앞뒤로 넘기기 ────────────────────────────────
                        하루를 히어로와 같은 얼굴로 훑습니다. 넘겨 보는 중에만
                        `지금으로` 가 붙어서, 카드가 현재를 말하고 있지 않다는 걸
                        되돌릴 방법과 함께 알려 줍니다 */}
                    {blocks.length > 0 && (
                        <div className="mt-3 flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => step(-1)}
                                disabled={cursor <= 0}
                                title="이전 수업"
                                aria-label="이전 수업"
                                className="flex h-7 w-7 items-center justify-center border-2 border-black/20 bg-white transition-colors duration-100 hover:border-black disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-black/20"
                            >
                                <ChevronLeft size={14} strokeWidth={3} />
                            </button>
                            <button
                                type="button"
                                onClick={() => step(1)}
                                disabled={cursor >= blocks.length - 1}
                                title="다음 수업"
                                aria-label="다음 수업"
                                className="flex h-7 w-7 items-center justify-center border-2 border-black/20 bg-white transition-colors duration-100 hover:border-black disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-black/20"
                            >
                                <ChevronRight size={14} strokeWidth={3} />
                            </button>
                            {browsing && (
                                <button
                                    type="button"
                                    onClick={() => setBrowseIndex(null)}
                                    className="ml-1 flex items-center gap-1 border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white transition-colors duration-100 hover:bg-black/80"
                                >
                                    <LocateFixed size={11} strokeWidth={3} />
                                    지금으로
                                </button>
                            )}
                        </div>
                    )}

                    {/* 화면에서 제일 큰 글자 — 여기가 시선이 처음 닿는 자리입니다.
                        **과목명 자체가 학과색을 입습니다** — 왼쪽 띠와 같은 색이라
                        띠가 무슨 뜻인지 따로 설명하지 않아도 읽힙니다 */}
                    <p
                        className={`mt-2.5 text-[28px] font-black leading-[1.05] tracking-tight md:text-[34px] ${
                            shown ? "" : !isSchoolDay ? "text-black" : "text-black/40"
                        }`}
                        style={
                            shown
                                ? { color: getDepartmentColor(shown.department) }
                                : undefined
                        }
                    >
                        {browsing ? getKoreanName(browsing.klass.subject) : headline}
                    </p>

                    {shown ? (
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold text-black/45">
                            <MapPin size={14} strokeWidth={2.75} className="shrink-0" />
                            <span className="font-black text-black">{shown.room}</span>
                            <span>· {shown.teacher}</span>
                            <span>· {shown.section.replace(/[^0-9]/g, "")}분반</span>
                        </p>
                    ) : (
                        <p className="mt-2 text-[13px] font-bold text-black/45">
                            {untilNext !== null && untilNext > 0
                                ? `다음 수업까지 ${duration(untilNext)}`
                                : (quip ?? "오늘 수업은 모두 끝났습니다.")}
                        </p>
                    )}

                    {session.off_reason === "vacation" && session.resumes_on && (
                        <VacationBar
                            label={session.label}
                            since={session.since}
                            resumesOn={session.resumes_on}
                            daysLeft={session.days_left}
                        />
                    )}

                    {/* ── 남은 시간 ─────────────────────────────────
                        목록이 못 하는 말 ①. 줄은 "14:40 일반지구과학" 까지만 알지
                        지금 그 수업이 얼마나 남았는지는 모릅니다 */}
                    {shownStart && shownEnd && shownRemain !== null && (
                        <div className="mt-4">
                            <div className="flex items-baseline justify-between gap-3 text-[11px] font-black tabular-nums">
                                <span className="text-black/40">
                                    {hhmm(shownStart.start_minute)} –{" "}
                                    {hhmm(shownEnd.end_minute)}
                                </span>
                                <span className={browsing ? "text-black/45" : ""}>
                                    {shownRemain}
                                </span>
                            </div>
                            {/* 채우는 색은 핑크 하나 — 이것도 "지금" 입니다 */}
                            <div className="mt-1.5 h-3 border-2 border-black bg-white">
                                <div
                                    className="h-full bg-retro-primary transition-[width] duration-700"
                                    style={{
                                        width: `${Math.min(
                                            100,
                                            Math.max(
                                                0,
                                                ((liveMinute - shownStart.start_minute) /
                                                    (shownEnd.end_minute -
                                                        shownStart.start_minute)) *
                                                    100,
                                            ),
                                        )}%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── 다음 ─────────────────────────────────────
                        목록이 못 하는 말 ②③. 수업 중에도 늘 보입니다 — V2 는 공강일
                        때만 다음을 말해서, 정작 "이거 끝나고 어디로 가지" 에는 답이
                        없었습니다 */}
                    {shownNext && (
                        <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t-2 border-black/10 pt-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/30">
                                Next
                            </span>
                            <ArrowRight
                                size={13}
                                strokeWidth={3}
                                className="shrink-0 text-black/25"
                            />
                            <span className="min-w-0 truncate text-[13px] font-black">
                                {shownNext.period}교시 {getKoreanName(shownNext.subject)}
                            </span>
                            <span className="text-[11px] font-bold text-black/40">
                                {shownNext.room}
                            </span>
                            {shownNextStart !== null && (
                                <span className="text-[11px] font-black tabular-nums text-black/40">
                                    {hhmm(shownNextStart)}
                                </span>
                            )}
                            {/* 건물을 옮겨야 하는지 — 쉬는시간 10분을 어떻게 쓸지가
                                여기서 갈립니다 */}
                            {shownMoving && (
                                <span className="flex items-center gap-1 border-2 border-black px-1.5 py-0.5 text-[10px] font-black">
                                    <Footprints size={11} strokeWidth={3} />
                                    교실 이동
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* ── 오늘 일정 ────────────────────────────────────
                    "지금" 과 성격이 다릅니다 — 저건 이 순간이고 이건 하루 종일입니다.
                    V2 는 둘을 한 칸에 세로로 붙여 뒀는데, 그래서 주인공 칸이 절반으로
                    쪼개져 있었습니다 */}
                {hasEvents && (
                    <div className="flex min-w-0 flex-col border-t-2 border-black/10 p-5 lg:border-l-2 lg:border-t-0">
                        <RetroSubTitle title="Events" icon={CalendarDays} iconSize={14} />
                        <ul className="mt-3 space-y-2">
                            {events.slice(0, EVENT_LIMIT).map((event) => (
                                /* 왼쪽 색 막대가 곧 분류입니다 — 점보다 눈에 걸리고
                                   줄이 여럿일 때 세로로 정렬돼 읽힙니다 */
                                <li
                                    key={event.id}
                                    className="flex items-stretch gap-2"
                                >
                                    <span
                                        className={`w-1 shrink-0 ${CATEGORY_STYLE[event.category].dot}`}
                                    />
                                    <span className="min-w-0 flex-1">
                                        {/* 옆 칸(급식)과 **크기도 굵기도 같습니다** —
                                            한 행에 나란히 선 두 칸은 같은 층의 정보라,
                                            한쪽만 굵으면 무게가 달라 보입니다 */}
                                        <span className="block truncate text-[13.5px] font-bold">
                                            {event.title}
                                        </span>
                                        {timeLabel(event) && (
                                            <span className="block text-[10px] font-bold tabular-nums text-black/35">
                                                {timeLabel(event)}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        {events.length > EVENT_LIMIT && (
                            <p className="mt-2 text-[12px] font-bold text-black/25">
                                외 {events.length - EVENT_LIMIT}개
                            </p>
                        )}
                    </div>
                )}

                {/* 급식 — 없어도 칸은 남깁니다(`KSAIN_API_KEY` 가 없으면 서버가
                    `meal: null` 을 줍니다). 지우면 기능이 사라진 것처럼 보입니다 */}
                <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t-2 border-black/10 lg:border-l-2 lg:border-t-0">
                    {meal ? (
                        <MealCard meal={meal} bare fill />
                    ) : (
                        <div className="flex flex-1 items-center justify-center p-5">
                            <p className="flex items-center gap-2 text-[12px] font-bold text-black/25">
                                <CalendarOff size={16} className="shrink-0" />
                                급식 정보가 없습니다
                            </p>
                        </div>
                    )}
                </div>
            </RetroCard>

            {/* ══ 아래 행 — 하루 | 이 학기 ═══════════════════════════
                **오늘(왼쪽)과 한 주(오른쪽)를 나란히 둡니다.** 주간 격자를 전폭으로
                두면 칸 하나가 200px 이 되어 4:3 을 맞추려면 행이 150px 씩 필요하고,
                격자만 1300px 을 넘어갑니다 — 폭을 절반으로 줄이면 같은 비율이 훨씬
                작은 높이로 나옵니다. 덤으로 오늘 목록이 세로로 길어져 스크롤이
                줄어듭니다 */}
            <div className="grid items-stretch gap-4 md:gap-5 xl:grid-cols-[minmax(0,1fr)_27rem]">
                {/* ⚠️ **DOM 은 오늘이 먼저입니다.** 좁은 화면에서는 1열로 쌓이는데,
                    거기서 한 주가 오늘보다 위에 오면 안 됩니다 — 넓을 때만 자리를
                    바꿉니다(`xl:order-2`) */}
                {/* ⚠️ **조건을 카드 바깥에 두지 마세요.** 수업이 없는 날에도 이 칸은
                    남아야 합니다 — 카드째 지우면 옆의 주간 격자만 덩그러니 남고,
                    조건을 `RetroCard` 안에 두면 테두리와 그림자만 그려져 높이 0 짜리
                    검은 줄이 박힙니다. 둘 다 아니고 **빈 상태를 그리는 것**이 답입니다 */}
                <div className="flex min-w-0 flex-col gap-4 md:gap-5 xl:order-2">
                    <RetroCard className="flex flex-col overflow-hidden bg-white xl:min-h-0 xl:flex-1">
                        {hasTimetable ? (
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-5">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <RetroSubTitle
                                        title="Today"
                                        icon={CalendarDays}
                                        iconSize={15}
                                    />
                                    <span className="flex items-baseline gap-3">
                                        <span className="text-[11px] font-bold tabular-nums text-black/35">
                                            수업 {today.length}개
                                            {freeMinutes > 0 &&
                                                ` · 공강 ${duration(freeMinutes)}`}
                                        </span>
                                        {/* 되돌아가는 길. 스크롤을 앱이 되돌리지 않는
                                            대신, 여기로 언제든 돌아올 수 있어야 합니다 */}
                                        <button
                                            type="button"
                                            onClick={() => placeNow(true)}
                                            title="지금 교시가 가운데 오도록 목록을 되돌립니다"
                                            className="flex shrink-0 items-center gap-1 text-[11px] font-black text-black/45 transition-colors duration-100 hover:text-black"
                                        >
                                            <LocateFixed size={12} strokeWidth={2.5} />
                                            지금
                                        </button>
                                    </span>
                                </div>

                                {/* 하루를 가로로 한 번 훑고(자), 그다음 줄로 읽습니다(목록).
                                    자는 시각에 비례해서 그려지므로 점심·저녁이 구멍으로
                                    남고, 목록은 그 구멍을 줄로 펴서 보여 줍니다 */}
                                <DayRuler
                                    periods={periods}
                                    breaks={breaks}
                                    today={today}
                                    nowMinute={isSchoolDay ? liveMinute : null}
                                />

                                {/* 좁은 화면에선 세로로 쌓여 `flex-1` 이 0 이 됩니다 —
                                    그때만 높이를 직접 줍니다.

                                    ⚠️ **경계선은 스크롤 상자 바깥에 둡니다.** 안쪽 목록이
                                    제 테두리를 갖고 있으면 그게 같이 스크롤돼서, 잘린
                                    첫 줄이 **글자가 반쯤 지워진 것처럼** 보입니다 — 선이
                                    고정돼 있어야 "여기서 잘린다" 로 읽힙니다 */}
                                <div className="relative mt-5 h-60 min-h-0 border-y-2 border-black/10 lg:h-auto lg:min-h-[17rem] lg:flex-1 xl:min-h-[12rem]">
                                    <div ref={boxRef} className="absolute inset-0 overflow-y-auto">
                                        <TodayTimeline
                                            today={today}
                                            periods={periods}
                                            nowMinute={isSchoolDay ? liveMinute : null}
                                            showFree
                                            bleed={false}
                                            focusPeriod={focusPeriod}
                                            focusRef={rowRef}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4 md:p-5">
                                <RetroSubTitle
                                    title="Today"
                                    icon={CalendarDays}
                                    iconSize={15}
                                />
                                <div className="flex flex-1 items-center justify-center py-12">
                                    <p className="flex items-center gap-2 text-[12px] font-bold text-black/25">
                                        <CalendarOff size={16} className="shrink-0" />
                                        오늘은 정해진 일정이 없습니다
                                    </p>
                                </div>
                            </div>
                        )}
                    </RetroCard>
                </div>

                {/* 위 카드가 **오늘**이라면 여기는 **이 학기**입니다 */}
                <WeekTimetable home={home} liveMinute={liveMinute} planned={planned} />
            </div>
        </div>
    );
};

export default TodayCardV3;
