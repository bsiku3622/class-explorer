/**
 * 내 시간표 — 한 주를 격자 하나로.
 *
 * ```
 * ┌ 내 시간표 ──────────────────────────── 주 27교시 ┐
 * ├────┬──────┬──────┬──────┬──────┬──────┤
 * │    │  월  │[ 화 ]│  수  │  목  │  금  │  ← 오늘만 검은 바에서 흰 칸으로 반전
 * ├────┼──────┼──────┼──────┼──────┼──────┤
 * │ 1  │      │      │      │      │┌────┐│
 * │    │      │      │      │      ││미적││  ← 수업은 테두리 있는 칩
 * │ 2  │┌────┐│┏━━━━┓│┌────┐│┌────┐│└────┘│
 * │    ││미적│││선형│││미적│││선형││      │
 * │ 3  │└────┘│┃(지금)┃│└────┘│└────┘│      │  ← 지금만 채웁니다
 * ├╱╱╱╱┼╱╱╱╱╱╱┼╱╱╱╱╱╱┼╱╱╱╱╱╱┼╱╱╱╱╱╱┼╱╱╱╱╱╱┤  ← 점심 (빗금)
 * │ 5  │┌────┐│      │┌────┐│┌────┐│      │
 * └────┴──────┴──────┴──────┴──────┴──────┘
 * ```
 *
 * 홈의 위 카드가 **오늘**을 말하는 자리라면 여기는 **이 학기**를 말합니다 — 그래서
 * `today` 와 달리 방학·주말에도 그대로 그립니다 (`week` 는 서버가 안 비웁니다).
 * 방학에 시간표가 사라지면 다음 학기 계획을 세울 때 볼 데가 없어집니다.
 *
 * ## 표가 아니라 **지도**입니다
 *
 * 한동안 이걸 스프레드시트처럼 그렸습니다 — 칸마다 옅은 회색(`black/[0.05]`)을 깔고
 * 머리카락 같은 선(`black/10`)으로 격자를 쳤는데, 두 가지가 한꺼번에 망가졌습니다.
 *
 * 1. **주의 모양이 안 보였습니다.** 5% 회색은 흰 배경과 거의 구별되지 않아서, 한 주가
 *    통째로 옅은 회색 얼룩으로 읽혔습니다. 어디가 비었는지 세어야 알 수 있었습니다
 * 2. **어느 교시인지 못 읽었습니다.** 글자를 칸 **가운데**에 뒀더니 연강 덩어리의
 *    이름이 두 교시 번호 사이에 걸쳐서, 6교시인지 7교시인지 알 방법이 없었습니다
 *
 * 그래서 `design-guide.md` 가 자(`DayRuler`)에서 쓰는 언어를 그대로 가져왔습니다 —
 * **테두리는 칸마다 두르고, 빈 자리는 진짜 비웁니다.** 검은 덩어리가 있는 곳이 수업,
 * 흰 곳이 공강입니다. 칸 사이의 1px 틈이 곧 쉬는시간이고요.
 *
 * ⚠️ 이게 "카드 안에 카드를 넣지 마세요" 와 부딪히지 않는 이유는 자와 같습니다 —
 * **이건 목록이 아니라 눈금이고, 칸 하나하나가 데이터입니다.** 대신 하드 쉐도우는
 * 안 씁니다. 스물일곱 개가 저마다 그림자를 지면 카드가 자갈밭이 됩니다.
 *
 * ## 칩은 **위쪽**에 붙습니다
 *
 * 이름도 교시 번호도 행 위에 맞춥니다. 연강이면 이름이 덩어리 맨 위에 붙어서
 * **시작 교시 번호와 일직선**이 됩니다 — 가운데 정렬이 못 하던 일입니다.
 *
 * ## 점심·저녁은 격자에 새깁니다
 *
 * 4교시(~12:30)와 5교시(13:40~) 사이는 70분, 9교시와 10교시 사이는 60분입니다. 그냥
 * 붙여 두면 5교시가 점심 뒤라는 게 안 보이고, 무엇보다 **연강으로 잘못 묶입니다.**
 * 교시 시각표에서 구멍을 찾아 빗금 띠를 넣고, 그 위로는 덩어리를 잇지 않습니다.
 *
 * ⚠️ **면을 채우는 건 "지금" 하나뿐입니다** (`design-guide.md`). 오늘 표시조차 색을
 * 안 씁니다 — 검은 요일 바에서 그 칸만 흰색으로 뒤집습니다. 핑크가 머리(오늘)와
 * 칩(지금) 두 군데에 있으면 같은 색이 두 뜻을 갖습니다.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, Check, Download } from "lucide-react";
import { toPng } from "html-to-image";
import type { BreakTime, HomeData, TodayClass } from "../../lib/friendsApi";
import { deriveHomeView } from "../../lib/homeView";
import {
    DAY_MAP,
    DAYS_ORDER,
    getDepartmentColor,
    getKoreanName,
    withAlpha,
} from "../../lib/utils";
import {
    searchHref,
    sectionQuery,
    subjectQuery,
    teacherQuery,
} from "../../lib/searchEngine";
import RetroCard from "../atoms/RetroCard";
import RetroSubTitle from "../atoms/RetroSubTitle";

/**
 * 교시 사이가 이보다 벌어지면 쉬는시간이 아니라 **구멍**입니다.
 *
 * 평소 쉬는시간은 10분이고, 점심(70분)·저녁(60분)만 크게 벌어집니다. 20분이면 둘
 * 사이 어디를 잘라도 같은 답이 나옵니다 — 교시 시각표가 조금 바뀌어도 안 흔들립니다.
 */
const GAP_MINUTES = 20;

/**
 * 고정(sticky)된 요일 머리의 배경 — **흰 바탕에 미리 섞어 둔 값**입니다.
 *
 * ⚠️ `bg-black/[0.03]`·`bg-retro-primary/25` 를 그대로 쓰면 안 됩니다. 97%·75% 가 비어
 * 있어서 **아래로 흐르는 칩이 요일 글자를 통과해** 보입니다. 보이던 색을 그대로
 * 유지하려면 같은 색을 흰색과 섞은 값을 박아야 합니다
 * (`#f7f7f7` = 검정 3% · `#ffd3ee` = `#ff4eba` 25%).
 */
const HEAD_BG = "#f7f7f7";
const HEAD_TODAY_BG = "#ffd3ee";

/**
 * 점심·저녁 띠의 빗금.
 *
 * ⚠️ **자(`DayRuler`)보다 옅습니다**(0.06 vs 0.13). 저긴 16px 짜리 얇은 띠라 진해야
 * 보이지만, 여기서는 구멍이 **교시 칸에 비례**해 90px 까지 커집니다 — 같은 농도로
 * 그 면적을 채우면 정보가 없는 자리가 화면에서 제일 시끄러워집니다.
 */
const HATCH: React.CSSProperties = {
    backgroundImage:
        "repeating-linear-gradient(-45deg, rgba(0,0,0,0.06) 0 3px, transparent 3px 7px)",
};

/** 자에서 쓰는 것과 같은 빗금 — **수업이 놓일 수 없는 구간**의 무늬입니다 */

/**
 * 칸에 들어갈 만큼 이름을 줄입니다 — **꼬리 괄호를 통째로 뗍니다.**
 *
 * ```
 * 미적분학2(EC)              → 미적분학2
 * 융합특강(AI시대의인간기술)  → 융합특강
 * ```
 *
 * `getKoreanName()` 은 **영문 설명만** 뗍니다(`(Basic Analytical Chemistry)`). 한글이
 * 든 괄호는 그대로 남는데, 격자 한 칸은 좁은 화면에서 60px 남짓이라 그대로 두면
 * `융합특강(AI시대의인…` 처럼 **이름이 아니라 괄호가 잘립니다.**
 *
 * ⚠️ **`(EC)` 도 뗍니다.** 한때 작은 꼬리표로 남겼는데, 그 8px 이 `미적분학2` 를
 * `미적분학…` 으로 밀어냈습니다. **여긴 내 시간표라 (EC) 가 가리는 게 없습니다** —
 * 같은 과목의 한국어반과 영어반을 동시에 듣는 사람은 없으니까요. 구별이 필요한
 * 화면(검색·트레이드)에서는 `getKoreanName()` 이 그대로 남겨 둡니다.
 */
const tighten = (subject: string): string =>
    getKoreanName(subject).replace(/\s*\([^()]*\)$/, "");

type Day = (typeof DAYS_ORDER)[number];

/** 격자의 가로 한 줄 — 교시이거나, 교시 사이의 구멍입니다 */
type Slot =
    | { kind: "period"; period: number }
    | { kind: "gap"; name: string; after: number; minutes: number };

/** 격자에 놓이는 덩어리 하나 — 연강이면 `span` 이 2 이상입니다 */
interface Block {
    day: Day;
    /** 시작 교시 */
    period: number;
    /** 몇 교시짜리인가 */
    span: number;
    klass: TodayClass;
}

/**
 * 요일별 수업 목록 → 격자 덩어리.
 *
 * 이으려면 셋이 다 맞아야 합니다.
 *
 * - **교실까지 같아야 합니다.** 같은 과목이라도 교실이 바뀌면 사이에 이동이 있어서,
 *   한 덩어리로 묶으면 옮겨야 하는 걸 놓칩니다
 * - **시간이 붙어 있어야 합니다.** 4교시와 5교시는 번호가 이어지지만 사이에 점심이
 *   70분 있습니다 — 번호만 보고 이으면 **점심을 가로지르는 연강**이 생깁니다
 */
const buildBlocks = (
    week: Record<string, TodayClass[]>,
    byPeriod: Map<number, { start_minute: number; end_minute: number }>,
): Block[] => {
    const blocks: Block[] = [];
    DAYS_ORDER.forEach((day) => {
        const classes = [...(week[day] ?? [])].sort((a, b) => a.period - b.period);
        classes.forEach((klass) => {
            const last = blocks[blocks.length - 1];
            const prevEnd = last
                ? byPeriod.get(last.period + last.span - 1)?.end_minute
                : undefined;
            const hereStart = byPeriod.get(klass.period)?.start_minute;
            // 교시 시각표를 못 받았으면 번호만 보고 잇습니다 — 예전처럼이라도 도는 게
            // 낫습니다 (`periods` 는 홈 응답에 실려 오므로 보통은 있습니다)
            const touching =
                prevEnd === undefined || hereStart === undefined
                    ? true
                    : hereStart - prevEnd <= GAP_MINUTES;
            const continues =
                last !== undefined &&
                last.day === day &&
                last.period + last.span === klass.period &&
                touching &&
                last.klass.subject === klass.subject &&
                last.klass.section === klass.section &&
                last.klass.room === klass.room;
            if (continues) last.span += 1;
            else blocks.push({ day, period: klass.period, span: 1, klass });
        });
    });
    return blocks;
};

/**
 * 구멍에 이름을 붙입니다 — `breaks` 중 **가장 많이 겹치는** 것을 고릅니다.
 *
 * 점심 구멍(12:30~13:40)에는 `점심`(40분)과 `학급모임`(20분)이 둘 다 걸칩니다.
 * 처음 찾은 걸 쓰면 순서에 따라 답이 달라지므로 긴 쪽을 고릅니다.
 */
const gapName = (from: number, to: number, breaks: BreakTime[]): string => {
    let name = "";
    let longest = 0;
    for (const item of breaks) {
        const overlap =
            Math.min(to, item.end_minute) - Math.max(from, item.start_minute);
        if (overlap > longest) {
            longest = overlap;
            name = item.name;
        }
    }
    return name;
};

interface WeekTimetableProps {
    home: HomeData;
    /** 홈이 굴리는 시계 (서버 시각 + 그 뒤로 흐른 시간) */
    liveMinute: number;
    /** 등록된 시간표가 아니라 **트레이드 계획**을 그리는 중인가 (`HomePage`) */
    planned?: boolean;
}

const WeekTimetable: React.FC<WeekTimetableProps> = ({
    home,
    liveMinute,
    planned = false,
}) => {
    // `?? {}` 는 배포 중 한쪽만 새 버전일 때를 버팁니다 — 옛 서버는 `week` 를 안 보냅니다.
    // `useMemo` 로 감싸는 건 그 빈 객체가 매 렌더 새로 만들어지지 않게 하려는 것입니다
    const week = useMemo(() => home.week ?? {}, [home.week]);
    const periods = useMemo(() => home.periods ?? [], [home.periods]);
    const breaks = useMemo(() => home.breaks ?? [], [home.breaks]);
    const byPeriod = useMemo(
        () => new Map(periods.map((item) => [item.period, item])),
        [periods],
    );

    /** 파생값은 홈 전체가 한 곳에서 셉니다 — 여기서 따로 계산하면 위 카드와 어긋납니다 */
    const { isSchoolDay, livePeriod } = deriveHomeView(home, liveMinute);
    const today = isSchoolDay ? home.now.day : null;

    const blocks = useMemo(() => buildBlocks(week, byPeriod), [week, byPeriod]);

    /**
     * 그릴 교시 범위 — **수업이 있는 데까지만** 그립니다.
     *
     * 1~11교시를 늘 다 그리면 10·11교시(자습)가 비어 있는 사람에게는 격자 아래
     * 5분의 1이 통째로 빈 칸이 됩니다. 반대로 수업이 있는 교시만 골라 뽑으면 2교시
     * 다음이 5교시인 게 안 보이므로, **처음부터 끝까지 이어서** 그립니다.
     */
    const rows = useMemo(() => {
        if (blocks.length === 0) return [];
        const first = Math.min(...blocks.map((b) => b.period));
        const last = Math.max(...blocks.map((b) => b.period + b.span - 1));
        return Array.from({ length: last - first + 1 }, (_, i) => first + i);
    }, [blocks]);

    /**
     * 교시 줄 사이에 구멍 줄을 끼웁니다. 격자 행이 곧 이 배열이라, 칩을 놓을 때
     * **교시 번호가 아니라 여기서의 자리**를 봐야 합니다.
     */
    const slots = useMemo(() => {
        const out: Slot[] = [];
        rows.forEach((period, index) => {
            if (index > 0) {
                const before = byPeriod.get(rows[index - 1]);
                const here = byPeriod.get(period);
                if (
                    before &&
                    here &&
                    here.start_minute - before.end_minute > GAP_MINUTES
                ) {
                    out.push({
                        kind: "gap",
                        name: gapName(before.end_minute, here.start_minute, breaks),
                        after: rows[index - 1],
                        minutes: here.start_minute - before.end_minute,
                    });
                }
            }
            out.push({ kind: "period", period });
        });
        return out;
    }, [rows, byPeriod, breaks]);

    /**
     * 교시 한 칸이 몇 분인가 — **구멍 높이를 여기에 비례시킵니다.**
     *
     * ⚠️ 점심(70분)을 16px 띠로 그렸더니 50분 수업이 64px 인 격자에서 **점심이 수업
     * 보다 짧아 보였습니다.** 격자는 시간을 재는 물건이라 같은 축 위에서 길이가
     * 뒤집히면 안 됩니다.
     */
    const unitMinutes = useMemo(() => {
        const first = periods[0];
        return first ? first.end_minute - first.start_minute : 50;
    }, [periods]);

    /** 교시 → 격자 행 번호 (1행은 요일 머리라 +2) */
    const rowOf = useMemo(() => {
        const map = new Map<number, number>();
        slots.forEach((slot, index) => {
            if (slot.kind === "period") map.set(slot.period, index + 2);
        });
        return map;
    }, [slots]);

    /**
     * **격자만 따로 이미지로 뽑습니다.** 스크롤 상자가 아니라 안쪽 격자를 찍어야
     * 화면 밖으로 넘어간 교시까지 다 담깁니다.
     */
    const gridRef = useRef<HTMLDivElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);
    /**
     * 오늘·지금을 칠할지. **화면과 PNG 가 같은 스위치를 봅니다.**
     *
     * 한때 이걸 "PNG 를 강조 없이 찍기" 로만 뒀는데, 그러면 **화면에서는 확인할 방법이
     * 없는 설정**이 됩니다 — 찍어서 열어 봐야 결과를 압니다. 화면이 곧 미리보기가
     * 되게 하면 그 왕복이 사라지고, 찍기 직전에 상태를 바꿨다가 되돌리는 곡예
     * (`requestAnimationFrame` 두 번)도 필요 없어집니다.
     *
     * 켜진 상태가 기본입니다 — 홈은 "지금" 을 말하는 화면이고, 강조를 끄는 건 시간표를
     * 남에게 보낼 때처럼 **오늘이 뜻을 잃는 자리**에서만 하는 일입니다.
     */
    const [showToday, setShowToday] = useState(true);

    /**
     * "오늘·지금" 을 칠할 요일. 꺼져 있으면 `null` 이라 요일 머리·열 기둥·지금 칩이
     * 한꺼번에 조용해집니다 — 세 곳이 같은 값을 보고 있어서 한 군데만 빠지지 않습니다.
     */
    const markDay = showToday ? today : null;

    const exportPng = useCallback(async () => {
        const node = gridRef.current;
        if (!node) return;
        setSaving(true);
        // 화면에 보이는 그대로 찍습니다 — 오늘·지금 강조를 뺄지는 위의 스위치가 이미
        // 정해 놓았습니다. 찍는 순간에만 몰래 바꾸면 결과를 미리 볼 수 없습니다
        try {
            const url = await toPng(node, {
                pixelRatio: 2,
                backgroundColor: "#ffffff",
                // 스크롤로 잘린 부분까지 — 찍을 때는 제 크기를 그대로 씁니다
                width: node.scrollWidth,
                height: node.scrollHeight,
            });
            const link = document.createElement("a");
            // 계획을 찍은 파일이 "내 시간표" 이름으로 남으면 나중에 둘을 못 가립니다
            link.download = `시간표_${home.term.year}-${home.term.semester}${
                planned ? "_계획" : ""
            }.png`;
            link.href = url;
            link.click();
        } finally {
            setSaving(false);
        }
    }, [home.term, planned]);

    /**
     * 폰에서는 격자가 화면보다 넓어서 **월요일부터 보입니다** — 목요일인 사람은 열
     * 때마다 손으로 밀어야 합니다. 가로로 흐를 때만 오늘 열을 가운데로 옮겨 둡니다.
     *
     * ⚠️ **다 보이면 건드리지 않습니다.** 데스크톱에서 `scrollLeft` 를 만지면 아무
     * 일도 안 일어나야 하는데, 조건 없이 쓰면 브라우저가 카드로 포커스를 옮기며
     * 페이지가 덜컥 움직이는 경우가 있습니다.
     */
    useEffect(() => {
        const box = boxRef.current;
        if (!box || !today) return;
        if (box.scrollWidth <= box.clientWidth) return;
        const index = DAYS_ORDER.findIndex((d) => d === today);
        if (index < 0) return;
        const rail = 64; // 교시 열 4rem — 고정이라 스크롤 계산에서 빼 둡니다
        const dayWidth = (box.scrollWidth - rail) / DAYS_ORDER.length;
        const center = rail + dayWidth * index + dayWidth / 2;
        box.scrollLeft = Math.max(0, center - (box.clientWidth + rail) / 2);
    }, [today, rows.length]);

    const total = useMemo(
        () => DAYS_ORDER.reduce((sum, day) => sum + (week[day]?.length ?? 0), 0),
        [week],
    );

    // 학번이 아직 안 붙었거나 이 학기에 수업이 없는 계정 — 빈 격자를 그려 봐야
    // 알려 주는 게 없습니다
    if (rows.length === 0) return null;

    return (
        <RetroCard className="overflow-hidden bg-white">
            {/* ⚠️ **줄바꿈을 허용합니다.** 제목·`계획` 표식·주 교시 수·체크박스·PNG 까지
                다섯 덩어리라, 폰(390px)에서 한 줄에 밀어 넣으면 380px 을 넘겨 **글자끼리
                겹칩니다.** 오른쪽 뭉치를 통째로 아랫줄로 내려보내면 둘 다 온전합니다 */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 md:px-5">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate">
                        <RetroSubTitle
                            title="Timetable"
                            icon={CalendarRange}
                            iconSize={15}
                        />
                    </span>
                    {/* 격자만 따로 보거나 PNG 로 찍는 자리라, 계획이라는 말이 여기에도
                        있어야 합니다 — 위 히어로의 표식은 잘라 낸 그림에 안 담깁니다 */}
                    {planned && (
                        <span className="shrink-0 border-2 border-black bg-retro-accent1 px-1.5 py-0.5 text-[10px] font-black">
                            계획
                        </span>
                    )}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="text-[12px] font-bold tabular-nums text-black/35">
                        주 {total}교시
                    </span>
                    {/* 화면과 PNG 를 같이 바꾸는 스위치라 격자 머리에 둡니다 —
                        내보내기 옵션이 아니라 **이 격자를 어떻게 볼지**의 문제입니다 */}
                    <button
                        type="button"
                        onClick={() => setShowToday((v) => !v)}
                        aria-pressed={showToday}
                        title="오늘 열·지금 수업 강조를 켜고 끕니다 (PNG 도 보이는 그대로 찍힙니다)"
                        className="flex items-center gap-1.5 text-[11px] font-black text-black/45 transition-colors duration-100 hover:text-black"
                    >
                        {/* 네모 + 체크 — 이 화면에는 폼 요소가 없어서 브라우저 기본
                            체크박스를 쓰면 유일하게 둥근 물건이 됩니다 */}
                        <span
                            className={`flex h-3.5 w-3.5 items-center justify-center border-2 border-black ${
                                showToday ? "bg-black" : "bg-white"
                            }`}
                        >
                            {showToday && (
                                <Check size={10} strokeWidth={4} className="text-white" />
                            )}
                        </span>
                        현재 요일 표시
                    </button>
                    <button
                        type="button"
                        onClick={() => void exportPng()}
                        disabled={saving}
                        title="이미지로 저장"
                        className="flex items-center gap-1 border-2 border-black px-2 py-1 text-[11px] font-black shadow-[2px_2px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:opacity-40"
                    >
                        <Download size={12} strokeWidth={3} />
                        {saving ? "저장 중" : "PNG"}
                    </button>
                </span>
            </div>

            {/* 격자는 카드 **끝까지** 붙습니다 — 여백을 두면 검은 요일 머리가 카드 안의
                또 다른 카드로 읽힙니다 (`design-guide.md` 의 "카드 안에 카드") */}
            {/* 교시가 많으면 카드가 통째로 길어져 옆 칸(오늘)과 균형이 깨집니다 —
                격자만 제 안에서 흐르게 둡니다.

                ⚠️ **가로로도 흐릅니다** — `overscroll-x-contain` 은 격자 끝에서 손가락이
                페이지를 끌고 가지 않게 잡아 줍니다 (폰에서 좌우로 훑다 보면 뒤로가기
                제스처가 걸립니다) */}
            <div
                ref={boxRef}
                className="max-h-[calc(100vh-14rem)] overflow-auto overscroll-x-contain"
            >
            {/* ⚠️ **폰에서 다섯 열을 우겨넣지 않습니다.** 390px 화면에서 한 칸이 57px 이
                되면 `5분반 · 박인숙` 이 `5분…` 으로 잘리고 과목명도 두 줄 안에 안
                들어갑니다 — 시간표를 여는 이유(어느 교실로, 누구 수업)가 통째로
                사라집니다. **최소 폭을 주고 가로로 흐르게** 두면 한 칸이 99px 이 되어
                세 줄이 다 읽힙니다.

                `xl` 에서 다시 푸는 건 그때 격자가 오늘 목록과 **2열로 나란히** 서면서
                제 폭이 34rem 남짓이 되기 때문입니다 — 최소 폭을 그대로 두면 데스크톱에
                없던 가로 스크롤이 생깁니다 */}
            <div
                ref={gridRef}
                className="grid min-w-[35rem] bg-white xl:min-w-0"
                style={{ gridTemplateColumns: "4rem repeat(5, minmax(0, 1fr))" }}
            >
                {/* ── 요일 머리 ───────────────────────────────────────
                    ⚠️ **다섯 칸을 통째로 검게 칠하지 않습니다.** 한동안 검은 바에
                    흰 글씨였는데, 격자에서 제일 무거운 덩어리가 **정보가 제일 적은
                    줄**이었습니다 — 요일 다섯 글자를 읽자고 카드 위쪽에 검은 띠를
                    두르는 셈이라, 아래 칩들이 그 무게에 눌렸습니다.

                    이제 머리는 흰 바탕이고 **오늘 한 칸만 핑크로 채웁니다.** 그
                    칸에서 아래로 **핑크 기둥이 이어져** 머리와 열이 한 덩어리로
                    읽힙니다 — 다섯 칸을 다 칠하면 그 연결이 안 보입니다.

                    ⚠️ 그래서 이 화면에는 **핑크가 세 농도로 있습니다** — 머리의
                    오늘(100%), 오늘 열 기둥(7%), 격자 안의 "지금"(100%). 셋 다 같은
                    것을 가리키므로(오늘 · 오늘의 지금) 뜻이 갈리지 않습니다. 네
                    번째 자리에 핑크를 쓰면 그때는 정말로 갈라집니다 */}
                {/* 교시 열과 요일 머리가 둘 다 고정이라 **모서리도 고정**입니다.
                    안 그러면 가로로 흘릴 때 이 칸만 따라 움직여 구멍이 생깁니다 */}
                <div
                    className="sticky left-0 top-0 z-30 border-b border-black/10"
                    style={{ gridColumn: 1, gridRow: 1, backgroundColor: HEAD_BG }}
                />
                {DAYS_ORDER.map((day, index) => (
                    <div
                        key={day}
                        /* ⚠️ **오늘도 형광으로 꽉 채우지 않습니다.** 흰 바탕에 한 칸만
                           100% 핑크였더니 격자에서 제일 센 물건이 **정보가 제일 적은
                           칸**이었습니다 — 칩·자·목록과 같은 문법(옅은 채움 + 진한
                           글자)으로 맞추고, 나머지 요일은 옅은 회색 바로 깔아 머리가
                           한 줄로 읽히게 합니다 */
                        /* 세로선은 **머리에도** 긋습니다 — 아래 칸에만 있으면
                           요일 칸의 오른쪽에만 선이 보여서 칸이 오른쪽으로 밀린
                           것처럼 읽힙니다 */
                        /* ⚠️ **고정된 칸의 배경은 불투명해야 합니다.** `bg-black/[0.03]`
                           은 97% 가 비어 있어서, 아래로 흐르는 칩이 요일 글자를 통과해
                           보입니다 — 같은 색을 **흰 바탕에 섞은 값**으로 박아 둡니다 */
                        className="sticky top-0 z-20 flex items-center justify-center border-b border-l border-black/10 py-2.5 text-[13px] font-black"
                        style={{
                            gridColumn: index + 2,
                            gridRow: 1,
                            backgroundColor: day === markDay ? HEAD_TODAY_BG : HEAD_BG,
                            color: day === markDay ? "#ff4eba" : "rgba(0,0,0,0.7)",
                        }}
                    >
                        {DAY_MAP[day]}
                    </div>
                ))}

                {/* ── 오늘 기둥 ────────────────────────────────────
                    오늘 **열 전체**에 옅은 핑크를 깝니다. 머리 한 칸만 칠하면 아래로
                    내려갈수록 어느 열이 오늘인지 놓치는데, 기둥이 서 있으면 9교시
                    근처에서도 눈이 그 열을 따라갑니다.

                    ⚠️ **바탕 셀보다 먼저 그립니다** — 나중에 그리면 격자선과 칩을
                    덮습니다. 빗금 띠까지 관통시켜야 점심에 기둥이 끊기지 않습니다.

                    ⚠️ **`gridRow: "2 / -1"` 로 쓰면 안 됩니다.** `-1` 은 *명시적*
                    그리드의 마지막 라인인데 이 격자는 `grid-template-columns` 만
                    있고 **행은 전부 암시적**이라, 끝을 못 가리키고 조용히 **헤더 한
                    칸 높이(42px)** 로 쪼그라듭니다. 기둥이 안 보이는 게 아니라 처음
                    42px 만 칠해집니다 — 행 개수로 직접 세야 합니다 */}
                {DAYS_ORDER.some((d) => d === markDay) && (
                    <div
                        style={{
                            gridColumn: DAYS_ORDER.findIndex((d) => d === markDay) + 2,
                            gridRow: `2 / span ${slots.length}`,
                        }}
                        className="bg-retro-primary/[0.07]"
                    />
                )}

                {/* ── 바탕 ─────────────────────────────────────────
                    수업 칩이 이 위에 얹히므로 **행 높이는 늘 여기서 나옵니다** — 한
                    행이 통째로 덮여도 높이가 무너지지 않습니다.

                    ⚠️ 가로선은 칸의 **위쪽**에 긋습니다. 아래쪽이면 마지막 줄의 선이
                    카드 테두리와 겹쳐 두 겹이 됩니다 */}
                {slots.map((slot, index) => {
                    const row = index + 2;
                    const line = index === 0 ? "" : "border-t border-black/[0.07]";

                    if (slot.kind === "gap") {
                        return (
                            <React.Fragment key={`gap-${slot.after}`}>
                                {/* 구멍의 이름은 교시 번호와 같은 열에 답니다 — 왼쪽
                                    열이 이 격자의 **시간 이름표** 자리입니다 */}
                                {/* 격자 안에서 **12px 아래로 내려가지 않습니다** —
                                    교시 번호·교실과 같은 하한입니다 */}
                                <div
                                    style={{ gridColumn: 1, gridRow: row }}
                                    className={`sticky left-0 z-10 flex items-center justify-center bg-white text-[12px] font-black leading-none text-black/45 ${line}`}
                                >
                                    {slot.name}
                                </div>
                                {/* 높이는 **교시 칸에 비례**합니다. 클래스는 고정으로
                                    두고 비율만 CSS 변수로 넘깁니다 — 임의값을 문자열로
                                    조립하면 Tailwind 가 유틸리티를 만들지 않습니다.

                                    ⚠️ **빗금을 걷어냈습니다.** 구멍이 시간에 비례해
                                    90px 까지 커지면서, 무늬가 화면에서 제일 큰 물건이
                                    됐습니다 — 왼쪽 이름표("점심")가 이미 무슨 자리인지
                                    말하므로 무늬는 덧붙임이었습니다 */}
                                <div
                                    style={{
                                        ...HATCH,
                                        gridColumn: "2 / -1",
                                        gridRow: row,
                                        ["--r" as string]: slot.minutes / unitMinutes,
                                    }}
                                    className={`h-[calc(6rem*var(--r))] md:h-[calc(7rem*var(--r))] xl:h-[calc(5rem*var(--r))] ${line}`}
                                />
                            </React.Fragment>
                        );
                    }

                    return (
                        <React.Fragment key={slot.period}>
                            {/* 번호도 **위쪽 정렬**입니다 — 칩의 이름과 눈높이가 맞아야
                                어느 교시에 시작하는지가 한 줄로 읽힙니다 */}
                            {/* 행이 64px 이 되면서 번호를 위에 붙여 두니 칸 한가운데가
                                통째로 비어 보였습니다 — **세로 가운데**로 옮깁니다.
                                (연강 이름과 눈높이를 맞추려던 규칙이었는데, 이름은
                                어차피 칩 안에서 위에 붙으므로 번호는 칸을 대표하면
                                됩니다) */}
                            {/* 가로로 흘릴 때 **교시 번호는 자리를 지킵니다** — 목요일
                                근처에서 오른쪽 끝까지 밀고 갔을 때 번호가 같이 사라지면
                                지금 보는 칸이 몇 교시인지 알 방법이 없습니다 */}
                            <div
                                style={{ gridColumn: 1, gridRow: row }}
                                className={`sticky left-0 z-10 flex items-center justify-center bg-white text-[12px] font-black leading-none text-black/45 ${line}`}
                            >
                                {slot.period}교시
                            </div>
                            {/* ⚠️ **좁은 화면이 더 높습니다** (52px vs 44px). 거꾸로
                                같지만 맞습니다 — 폰에서는 한 칸이 60px 남짓이라 이름이
                                두 줄로 펴져야 하고, 데스크톱은 칸이 200px 이라 어떤
                                과목명도 한 줄에 들어갑니다. 폭이 없으면 높이로 갚습니다 */}
                            {/* 세로선도 같은 무게로 긋습니다. 처음엔 칩의 검은 테두리가
                                요일을 가른다고 보고 뺐는데, **수업이 없는 행에서는 가를
                                게 없어서** 8교시 목요일을 찾으려면 머리부터 짚어 내려와야
                                했습니다. 격자는 여기서 장식이 아니라 좌표입니다 */}
                            {/* 세로선도 같은 무게로 긋습니다. 칩의 테두리가
                                요일을 가른다고 보고 뺐다가 되돌렸습니다 — **수업이
                                없는 행에서는 가를 게 없어서** 8교시 목요일을 찾으려면
                                요일 머리부터 짚어 내려와야 했습니다 */}
                            {DAYS_ORDER.map((day, dayIndex) => (
                                <div
                                    key={day}
                                    style={{ gridColumn: dayIndex + 2, gridRow: row }}
                                    className={`h-24 border-l border-black/10 md:h-28 xl:h-20 ${line}`}
                                />
                            ))}
                        </React.Fragment>
                    );
                })}

                {/* ── 수업 ─────────────────────────────────────────
                    바탕 **뒤에** 그려서 그 위에 얹힙니다. `m-px` 로 1px 씩 물러나
                    붙어 있는 칩끼리 테두리가 겹쳐 4px 로 뭉치지 않게 합니다 — 그
                    틈이 곧 쉬는시간입니다 */}
                {blocks.map((block) => {
                    const now =
                        block.day === markDay &&
                        livePeriod !== null &&
                        livePeriod >= block.period &&
                        livePeriod < block.period + block.span;
                    const color = getDepartmentColor(block.klass.department);
                    return (
                        <div
                            key={`${block.day}-${block.period}`}
                            /* 테두리를 **검정에서 학과색으로** 옮겼습니다. 스물일곱
                               개가 저마다 2px 검정을 두르면 격자가 통째로 무거워집니다
                               — 굵기는 그대로 두고 색만 바꿔도 무게가 확 내려갑니다.

                               ⚠️ **"지금" 도 꽉 채우지 않습니다.** 형광 핑크로 100%
                               채웠더니 칸 하나가 화면에서 제일 센 물건이 되어 정작
                               옆 칸을 읽는 걸 방해했습니다 — 같은 문법(옅은 채움 +
                               진한 테두리)에 색만 핑크입니다 */
                            style={{
                                gridColumn: DAYS_ORDER.indexOf(block.day) + 2,
                                gridRow: `${rowOf.get(block.period)} / span ${block.span}`,
                                backgroundColor: now
                                    ? "rgba(255, 78, 186, 0.22)"
                                    : withAlpha(color, 0.08),
                                borderColor: now ? "#ff4eba" : color,
                            }}
                            title={`${getKoreanName(block.klass.subject)} · ${block.klass.room} · ${block.klass.teacher}`}
                            className="m-px flex min-w-0 flex-col gap-0.5 overflow-hidden border-2 px-2 py-1.5"
                        >
                            {/* 두 줄까지 폅니다 — 한 줄로 자르면 `일반지구과학` 이
                                `일반지구…` 가 되어 무슨 과목인지 알 수 없습니다 */}
                            {/* 이름·분반·교사는 **검색으로 가는 문**입니다. 칸 안의
                                글자를 누르면 그 과목·분반·선생님이 검색되고, 검색어는
                                `searchEngine` 이 자기 문법에 맞게 만듭니다 */}
                            <Link
                                to={searchHref(subjectQuery(block.klass.subject))}
                                title={`${getKoreanName(block.klass.subject)} 검색`}
                                className="line-clamp-2 text-[13px] font-black leading-[1.2] hover:underline"
                                style={{ color: now ? "#ff4eba" : color }}
                            >
                                {tighten(block.klass.subject)}
                            </Link>
                            {/* 분반·교사 — 인쇄된 학교 시간표가 늘 적어 두는 줄입니다.
                                같은 과목을 여러 선생님이 나눠 맡으므로 **이름이 있어야
                                내 분반인지 확인**할 수 있습니다 */}
                            <span className="shrink-0 truncate text-[12px] font-bold leading-tight text-black/45">
                                <Link
                                    to={searchHref(
                                        sectionQuery(
                                            block.klass.subject,
                                            block.klass.section,
                                        ),
                                    )}
                                    title={`${getKoreanName(block.klass.subject)} ${block.klass.section.replace(/[^0-9]/g, "")}분반 검색`}
                                    className="hover:underline"
                                >
                                    {block.klass.section.replace(/[^0-9]/g, "")}분반
                                </Link>{" "}
                                ·{" "}
                                <Link
                                    to={searchHref(teacherQuery(block.klass.teacher))}
                                    title={`${block.klass.teacher} 검색`}
                                    className="hover:underline"
                                >
                                    {block.klass.teacher}
                                </Link>
                            </span>
                            {/* 교실은 **이름 쪽에 붙입니다.** 한때 `mt-auto` 로 칩
                                바닥에 밀어 뒀는데, 두 교시짜리에서는 그게 **아래 교시
                                자리**여서 `일반지구과학`(6–7교시)의 교실이 7교시 수업의
                                교실처럼 읽혔습니다 */}
                            <span className="shrink-0 truncate text-[12px] font-bold leading-tight text-black/45">
                                {block.klass.room}
                            </span>
                        </div>
                    );
                })}
            </div>
            </div>
        </RetroCard>
    );
};

export default WeekTimetable;
