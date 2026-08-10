/**
 * 자몽 — 학교에서 돌려 쓰는 Zamong 워크북을 그대로 옮긴 계산.
 *
 * 워크북에서는 과목 하나가 카드 한 장이고, 칸이 셋(학기·학점·평어)입니다. **학기를
 * 고르는 행위 하나가 이수 표시이자 학점 인정**이고, 재수강도 별도 장치 없이 학기를
 * 다시 고르면 끝입니다. 여기 있는 계산은 전부 그 규칙을 따릅니다.
 *
 * ⚠️ **실제 수강 이력과 섞지 마세요.** 자몽은 본인이 적는 선언이고, 수강 이력
 * (`/curriculum/progress`)은 학교 데이터가 말하는 사실입니다. 한때 둘을 합쳐 뒀는데
 * 재수강한 과목이 두 학기에 나타나면 어느 쪽이 이수인지 화면이 정할 수 없었습니다.
 * 이력은 참고 자료로 옆에 두고, 옮길지 말지는 사람이 정합니다.
 */

import {
    layoutGraph,
    type Course,
    type Graph,
    type Prereq,
} from "./curriculum";

/**
 * 워크북과 같은 학기 칸.
 *
 * 졸업까지는 여섯 학기지만 칸은 **여덟**입니다 — 휴학하면 그만큼 밀립니다. 안 쓰는
 * 칸은 로드맵이 조용히 접어 두므로 있어서 손해 볼 게 없습니다.
 */
export type TermKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "S";

export interface TermSlot {
    key: TermKey;
    label: string;
}

/** 서버가 `/curriculum`의 `terms`로 내려주지만, 못 받았을 때를 위한 기본값 */
export const DEFAULT_TERM_SLOTS: TermSlot[] = [
    ...Array.from({ length: 8 }, (_, index) => ({
        key: String(index + 1) as TermKey,
        label: `${index + 1}학기`,
    })),
    { key: "S", label: "계절학기" },
];

/** 졸업에 필요한 학기 수 — 7·8학기는 휴학 자리라 기본으로 접어 둡니다 */
export const REGULAR_TERMS = 6;

/** 카드 한 장의 기록. `term`이 없으면 학점에 들어가지 않습니다 */
export interface ZamongEntry {
    term: TermKey | null;
    grade: string | null;
    /** 영어강의로 들었는지 — EC 요건은 과목이 아니라 분반이 정합니다 */
    isEc: boolean;
}

export type ZamongMap = Record<string, ZamongEntry>;

export const emptyEntry = (): ZamongEntry => ({ term: null, grade: null, isEc: false });

/** 기록이 아무것도 없는 칸인지 — 이런 항목은 서버에 올리지 않습니다 */
export const isBlank = (entry: ZamongEntry | undefined): boolean =>
    !entry || (!entry.term && !entry.grade && !entry.isEc);

// ─── 과목 분류 ───────────────────────────────────────────────────────────────

/**
 * 워크북이 상자 색으로 칠해 둔 분류. 색까지 워크북을 따라갑니다 — 심화와 AP가 같은
 * 계열의 옅은 색·짙은 색인 것도 원본 그대로입니다(거기서도 파랑 두 톤입니다).
 */
export type Tier = "core" | "advanced" | "ap" | "special" | "convergence";

export const TIER_LABEL: Record<Tier, string> = {
    core: "핵심",
    advanced: "심화",
    ap: "AP",
    special: "특강",
    convergence: "융합",
};

/**
 * 카드 배경 — **워크북 상자 색 그대로**입니다.
 *
 * 처음에는 앱 팔레트(`retro-*`)를 옅게 깔아 봤는데 두 가지가 어긋났습니다. 하나는
 * 반투명이라 크림색 배경(`retro-bg`)과 섞여 **심화(시안)가 초록으로** 보인 것이고,
 * 다른 하나는 색이 달라지면 워크북을 보던 사람이 열을 다시 배워야 한다는 것입니다.
 * 색이 곧 분류라서, 여기서는 원본을 이깁니다.
 *
 * ⚠️ **불투명해야 합니다.** 알파를 붙이면 배경색에 따라 색이 달라집니다.
 *
 * 심화와 AP 가 같은 파랑의 옅은 톤·짙은 톤인 것도 원본 그대로입니다 — AP 는 심화에서
 * 한 단계 올라간 것이라 다른 색을 줄 이유가 없습니다.
 */
export const TIER_TINT: Record<Tier, string> = {
    core: "#ffebf8",
    advanced: "#e1efff",
    ap: "#b9daff",
    special: "#dadbff",
    convergence: "#e1ffe1",
};

/** 범례 표식 — 카드에서 보게 될 색과 같아야 하므로 배경색을 그대로 씁니다 */
export const TIER_COLOR = TIER_TINT;

export const TIER_ORDER: Tier[] = ["core", "advanced", "ap", "special", "convergence"];

export const tierOf = (course: Course): Tier =>
    (course.tier as Tier | null) ?? "advanced";

// ─── 실제 수강 이력 → 학기 칸 ────────────────────────────────────────────────

/**
 * 학번에서 입학 연도를 읽습니다 (`25-059` → 2025).
 *
 * 학번 앞 두 자리가 입학 연도라 이것만으로 "몇 번째 학기"를 셀 수 있습니다.
 */
export const admissionYear = (stuId: string): number | null => {
    const match = /^(\d{2})-/.exec(stuId);
    return match ? 2000 + Number(match[1]) : null;
};

/**
 * 실제 학기(`2026-1`)를 워크북의 학기 칸으로 옮깁니다.
 *
 * ⚠️ **딱 한 곳에서만 씁니다** — 자몽을 처음 여는 사람에게 밑칠을 해 주는 자리입니다.
 * 그 뒤로 자몽은 학교 데이터와 아무 관계가 없습니다. 재수강한 과목은 한 칸에 한 번만
 * 들어가서 마지막 학기가 이기므로, 밑칠은 어디까지나 출발점이고 맞추는 건 사람입니다.
 */
export const termSlotOf = (
    stuId: string,
    year: number,
    semester: number,
): TermKey | null => {
    const admitted = admissionYear(stuId);
    if (admitted === null) return null;
    const index = (year - admitted) * 2 + semester;
    return index >= 1 && index <= 8 ? (String(index) as TermKey) : null;
};

// ─── 정렬 ────────────────────────────────────────────────────────────────────

/** 이름 뒤의 `(EC)` 를 떼어 카탈로그 이름으로 */
const baseName = (name: string) => name.replace(/\(EC\)$/, "");

/**
 * 학기 안에서 과목을 늘어놓는 순서 — **학과 → 선수 깊이 → 가나다**.
 *
 * 가나다만으로 세우면 같은 학기에 담은 것들이 학과를 넘나들며 뒤섞여서, 내가 이번
 * 학기에 수학을 몇 개 담았는지 세려면 줄을 훑어야 합니다. 학과로 먼저 묶으면 그게
 * 한눈에 보이고, 학과 순서는 **학과 고르는 버튼 줄과 같습니다**(서버가 주는
 * `display_order`) — 두 곳이 다르면 눈이 매번 다시 찾습니다.
 *
 * 학과 안에서는 선수 깊이 순입니다. 수학1 → 수학2 → 미적분학1 처럼 실제로 쌓아 올린
 * 순서라, 가나다보다 훨씬 읽기 쉽습니다.
 */
export const buildCourseOrder = (
    byName: Map<string, Course>,
    departments: string[],
    depths: Map<string, number>,
): ((a: string, b: string) => number) => {
    const rank = new Map(departments.map((name, index) => [name, index]));
    return (a, b) => {
        const left = baseName(a);
        const right = baseName(b);
        const da = rank.get(byName.get(left)?.department ?? "") ?? departments.length;
        const db = rank.get(byName.get(right)?.department ?? "") ?? departments.length;
        if (da !== db) return da - db;
        const la = depths.get(left) ?? 0;
        const lb = depths.get(right) ?? 0;
        if (la !== lb) return la - lb;
        return left.localeCompare(right, "ko");
    };
};

/** 정렬 정보를 못 받았을 때 — 가나다 */
const defaultOrder = (a: string, b: string) => a.localeCompare(b, "ko");

// ─── 요약 (워크북 상단표) ────────────────────────────────────────────────────

export interface GraduationSpec {
    credits: Record<string, number>;
    hours: Record<string, number>;
    term_credits: { min: number; max: number };
}

export const DEFAULT_GRADUATION: GraduationSpec = {
    credits: { natural: 67, humanities: 52, convergence: 8, total: 127, ec: 10 },
    hours: { self_dev: 60, collab: 60, global: 60, total: 270 },
    term_credits: { min: 10, max: 30 },
};

/** 손으로 적는 비교과 시수 — 어디에도 데이터가 없습니다 */
export interface HourInput {
    self_dev: number;
    collab: number;
    global: number;
}

export const emptyHours = (): HourInput => ({ self_dev: 0, collab: 0, global: 0 });

export interface TermSummary extends TermSlot {
    credits: number;
    /** 이 학기에 담은 과목 이름 — 로드맵이 그대로 늘어놓습니다 */
    courses: string[];
    /**
     * 워크북의 "좋아요 / 맞추세요" — 한 학기에 담은 학점이 10~30 범위 안인지.
     * **빈 학기는 참입니다.** 아직 안 채운 학기나 휴학 자리를 위반으로 칠할 이유가
     * 없습니다 — 화면이 따로 "비어 있음"으로 그립니다.
     */
    ok: boolean;
    gpa: number | null;
}

export interface RequirementRow {
    key: string;
    label: string;
    earned: number;
    required: number;
    met: boolean;
}

export interface ZamongSummary {
    terms: TermSummary[];
    credits: { natural: number; humanities: number; convergence: number; total: number; ec: number };
    creditRequirements: RequirementRow[];
    hourRequirements: RequirementRow[];
    apCredits: number;
    /** 전체 평점 */
    overallGpa: number | null;
    /** 수과학 평점 — 워크북의 "수과학 GPA" */
    naturalGpa: number | null;
    gradedCredits: number;
    /** 이수했는데 평어를 아직 안 넣은 과목 수 (P/F 제외) */
    missingGrades: number;
    /** 영어강의로 들은 과목 — 워크북 상단표의 `EC` 줄 */
    ecCourses: string[];
    /**
     * 기록은 있는데 학기를 안 고른 과목. 학기가 없으면 학점이 붙을 자리가 없어
     * 셈에서 통째로 빠지므로, 화면이 따로 짚어 줘야 합니다.
     */
    unscheduled: string[];
    creditsReady: boolean;
    hoursReady: boolean;
}

const CREDIT_LABEL: Record<string, string> = {
    natural: "자연",
    humanities: "인문",
    convergence: "융합",
    total: "계",
    ec: "EC",
};

const HOUR_LABEL: Record<string, string> = {
    self_dev: "자기계발",
    collab: "협업",
    global: "세계시민",
    total: "총 시수",
};

const CREDIT_ORDER = ["natural", "humanities", "convergence", "total", "ec"];
const HOUR_ORDER = ["self_dev", "collab", "global", "total"];

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * 워크북 상단표를 그대로 계산합니다.
 *
 * **학기가 있는 항목만 셉니다.** 워크북 안내문의 "학기를 써야 학점 인정됨"이 그대로
 * 규칙입니다 — 평어만 넣고 학기를 비워 두면 어느 학기 학점인지 정할 수 없습니다.
 */
export const summarize = (
    entries: ZamongMap,
    byName: Map<string, Course>,
    slots: TermSlot[],
    graduation: GraduationSpec,
    gradePoints: Record<string, number>,
    hours: HourInput,
    /** 학기 안 과목 순서 — `buildCourseOrder` 를 넘기세요 */
    compare: (a: string, b: string) => number = defaultOrder,
): ZamongSummary => {
    const perTerm = new Map<
        TermKey,
        { credits: number; courses: string[]; points: number; graded: number }
    >();
    slots.forEach((slot) => perTerm.set(slot.key, { credits: 0, courses: [], points: 0, graded: 0 }));

    const credits = { natural: 0, humanities: 0, convergence: 0, total: 0, ec: 0 };
    let apCredits = 0;
    let points = 0;
    let gradedCredits = 0;
    let naturalPoints = 0;
    let naturalGraded = 0;
    let missingGrades = 0;
    const unscheduled: string[] = [];
    const ecCourses: string[] = [];

    Object.entries(entries).forEach(([name, entry]) => {
        const course = byName.get(name);
        if (!course || isBlank(entry)) return;
        if (!entry.term) {
            unscheduled.push(name);
            return;
        }

        credits[course.category] += course.credits;
        credits.total += course.credits;
        apCredits += course.ap_credits;
        if (entry.isEc) {
            credits.ec += course.credits;
            ecCourses.push(`${name}(EC)`);
        }

        const bucket = perTerm.get(entry.term);
        if (bucket) {
            bucket.credits += course.credits;
            bucket.courses.push(entry.isEc ? `${name}(EC)` : name);
        }

        // P/F는 등급이 아니라 통과 여부라 평점에서 뺍니다
        if (course.is_pf) return;
        const point = entry.grade ? gradePoints[entry.grade] : undefined;
        if (point === undefined) {
            missingGrades += 1;
            return;
        }
        points += point * course.credits;
        gradedCredits += course.credits;
        if (course.category === "natural") {
            naturalPoints += point * course.credits;
            naturalGraded += course.credits;
        }
        if (bucket) {
            bucket.points += point * course.credits;
            bucket.graded += course.credits;
        }
    });

    const { min, max } = graduation.term_credits;
    const terms: TermSummary[] = slots.map((slot) => {
        const bucket = perTerm.get(slot.key)!;
        return {
            ...slot,
            credits: bucket.credits,
            courses: bucket.courses.sort(compare),
            // 계절학기에는 하한이 없습니다 — 안 들어도 되는 학기라서요
            ok:
                bucket.credits === 0 ||
                (bucket.credits <= max && (slot.key === "S" || bucket.credits >= min)),
            gpa: bucket.graded ? round2(bucket.points / bucket.graded) : null,
        };
    });

    const creditRequirements: RequirementRow[] = CREDIT_ORDER.filter(
        (key) => graduation.credits[key] !== undefined,
    ).map((key) => {
        const earned = credits[key as keyof typeof credits];
        const required = graduation.credits[key];
        return { key, label: CREDIT_LABEL[key] ?? key, earned, required, met: earned >= required };
    });

    const hourValues: Record<string, number> = {
        ...hours,
        total: hours.self_dev + hours.collab + hours.global,
    };
    const hourRequirements: RequirementRow[] = HOUR_ORDER.filter(
        (key) => graduation.hours[key] !== undefined,
    ).map((key) => {
        const earned = hourValues[key] ?? 0;
        const required = graduation.hours[key];
        return { key, label: HOUR_LABEL[key] ?? key, earned, required, met: earned >= required };
    });

    return {
        terms,
        credits,
        creditRequirements,
        hourRequirements,
        apCredits,
        overallGpa: gradedCredits ? round2(points / gradedCredits) : null,
        naturalGpa: naturalGraded ? round2(naturalPoints / naturalGraded) : null,
        gradedCredits,
        missingGrades,
        ecCourses: ecCourses.sort(compare),
        unscheduled: unscheduled.sort(),
        creditsReady: creditRequirements.every((row) => row.met),
        hoursReady: hourRequirements.every((row) => row.met),
    };
};

// ─── 보드 배치 ───────────────────────────────────────────────────────────────

/**
 * 카드 크기.
 *
 * 워크북 카드는 다섯 줄(제목·영문명·학기·학점·평어)인데 **학점 줄을 제목으로
 * 올렸습니다** — 읽기만 하는 값이라 라벨을 붙인 줄을 따로 쓸 이유가 없고, 스무 장이
 * 늘어서면 "학점"이라는 회색 글자가 스무 번 반복됩니다.
 *
 * ⚠️ **더 줄이지 마세요.** 한때 184×100 에 글자 8.5~11.5px 로 욱여넣었는데, 앱에서
 * 제일 작은 글자가 배지 10px 인 걸 생각하면 그 아래로 내려간 것이었습니다. 카드는
 * 이 화면에서 **손이 닿는 유일한 곳**이라, 학기 칸이 19px 짜리면 고르기가 일입니다.
 */
export const CARD_WIDTH = 208;
export const CARD_HEIGHT = 136;

/**
 * 한 학과를 워크북 시트처럼 좌→우로 늘어놓습니다.
 *
 * 배치는 `layoutGraph`가 그대로 합니다 — 워크북이 선으로 그려 둔 선수관계를 우리가
 * 이미 읽어 뒀고(`curriculum_seed.json`), 가로 위치가 곧 선수 깊이라 시트와 같은
 * 모양이 나옵니다.
 *
 * ⚠️ **타 학과 선수는 판에 넣지 않습니다** — 카드가 글로 답니다 (`outsidePrereqs`).
 */
export const layoutBoard = (courses: Course[], prerequisites: Prereq[]): Graph =>
    layoutGraph(courses, prerequisites, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        columnGap: 52,
        rowGap: 18,
        align: "center",
    });
