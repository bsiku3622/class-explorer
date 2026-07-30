/**
 * 교육과정 계산 — 졸업 요건 진척도와 선수관계 그래프 배치.
 *
 * 데이터는 `/curriculum`(카탈로그·선수관계)과 `/curriculum/progress/{stuId}`(이수 이력)에서
 * 받아옵니다. 계산은 전부 클라이언트에서 합니다.
 */

export type Category = "natural" | "humanities" | "convergence";

export interface Course {
    name: string;
    english_name: string | null;
    department: string;
    category: Category;
    credits: number;
    ap_credits: number;
    is_pf: boolean;
    recommended_semester: string | null;
    description: string | null;
}

export interface Prereq {
    before: string;
    after: string;
    /** 같은 과목을 향한 다른 선수와 택일 관계 */
    alternative: boolean;
}

export interface Curriculum {
    courses: Course[];
    prerequisites: Prereq[];
    /** KEIS 과목명 → 카탈로그 과목명 */
    subject_map: Record<string, string>;
    requirements: Record<string, number>;
    /** 평어 → 평점 (4.3 만점) */
    grade_points: Record<string, number>;
}

/** 계정에 기록해 둔 이수 내역 — 과목명 → 평어 (평어 없이 이수만 체크 가능) */
export type GradeMap = Record<string, string | null>;

export interface ProgressTerm {
    year: number;
    semester: number;
    courses: { subject: string; course: string | null }[];
}

/**
 * 과목 하나가 지금 어떤 상태인지.
 *
 * `inferred`는 기록에는 없지만 들었을 수밖에 없는 과목입니다 — 미적분학1을 이수했다면
 * 그 선수인 수학1·수학2도 들었다는 뜻입니다. 수집 이전 학기가 비어 있어도 그래프가
 * 말이 되게 하려고 둡니다.
 */
export type CourseState = "taken" | "current" | "inferred" | "available" | "locked";

export const CATEGORY_LABEL: Record<Category, string> = {
    natural: "자연과학",
    humanities: "인문사회",
    convergence: "융합",
};

export const DEPARTMENT_ORDER = [
    "수학", "정보과학", "물리학", "화학", "생물학", "지구과학",
    "국어", "사회", "외국어", "예체능", "융합",
];

/** 과목명 → 선수 과목 목록 */
export const buildPrereqIndex = (prerequisites: Prereq[]): Map<string, Prereq[]> => {
    const index = new Map<string, Prereq[]>();
    prerequisites.forEach((edge) => {
        const list = index.get(edge.after);
        if (list) list.push(edge);
        else index.set(edge.after, [edge]);
    });
    return index;
};

/** 과목명 → 이 과목을 선수로 삼는 과목 목록 */
export const buildUnlockIndex = (prerequisites: Prereq[]): Map<string, string[]> => {
    const index = new Map<string, string[]>();
    prerequisites.forEach((edge) => {
        const list = index.get(edge.before);
        if (list) list.push(edge.after);
        else index.set(edge.before, [edge.after]);
    });
    return index;
};

/**
 * 선수 조건을 만족했는지 봅니다.
 *
 * 택일(`alternative`) 항목은 하나만 들어도 되고, 나머지는 모두 들어야 합니다.
 * 예: 예술속의물리 = (물리학및실험2 또는 일반물리학2), 법과학 = 화학및실험 + 생물학및실험
 */
export const prereqSatisfied = (
    course: string,
    taken: Set<string>,
    prereqIndex: Map<string, Prereq[]>,
): boolean => {
    const edges = prereqIndex.get(course);
    if (!edges || edges.length === 0) return true;

    const required = edges.filter((edge) => !edge.alternative);
    const optional = edges.filter((edge) => edge.alternative);

    if (!required.every((edge) => taken.has(edge.before))) return false;
    return optional.length === 0 || optional.some((edge) => taken.has(edge.before));
};

/**
 * 이수한 과목에서 선수 체인을 거슬러 올라가, 기록에 없지만 들었을 과목을 찾습니다.
 *
 * 택일 관계는 어느 쪽을 들었는지 알 수 없으므로 추론하지 않습니다.
 */
export const inferPrereqs = (
    taken: Set<string>,
    prereqIndex: Map<string, Prereq[]>,
): Set<string> => {
    const inferred = new Set<string>();
    const queue = [...taken];
    while (queue.length) {
        const name = queue.pop()!;
        (prereqIndex.get(name) ?? [])
            .filter((edge) => !edge.alternative)
            .forEach((edge) => {
                if (!taken.has(edge.before) && !inferred.has(edge.before)) {
                    inferred.add(edge.before);
                    queue.push(edge.before);
                }
            });
    }
    return inferred;
};

export const courseState = (
    course: string,
    taken: Set<string>,
    current: Set<string>,
    inferred: Set<string>,
    prereqIndex: Map<string, Prereq[]>,
): CourseState => {
    if (current.has(course)) return "current";
    if (taken.has(course)) return "taken";
    if (inferred.has(course)) return "inferred";
    // 이번 학기에 듣고 있는 과목도 선수를 채운 것으로 봅니다 — 다음 학기 계획을 세우는 게
    // 이 화면의 목적이라, 수강 중인 과목의 후속을 잠가 두면 쓸모가 없습니다
    const satisfied = prereqSatisfied(
        course,
        new Set([...taken, ...inferred, ...current]),
        prereqIndex,
    );
    return satisfied ? "available" : "locked";
};

export interface RequirementProgress {
    key: string;
    label: string;
    earned: number;
    required: number;
    /** 요건을 채웠는지 */
    met: boolean;
}

export interface Progress {
    totalCredits: number;
    apCredits: number;
    ecCredits: number;
    byCategory: Record<string, number>;
    requirements: RequirementProgress[];
    graduationReady: boolean;
}

const REQUIREMENT_LABEL: Record<string, string> = {
    natural: "자연과학",
    humanities: "인문사회",
    convergence: "융합",
    ec: "EC",
};

/**
 * 이수한 과목들로 졸업 요건 진척도를 계산합니다.
 *
 * `englishTaken`은 **영어강의로 들은** 과목들입니다. EC 요건은 과목의 성질이 아니라
 * 어느 분반을 들었느냐로 정해지므로, 교육과정 정의가 아니라 수강 이력에서 옵니다.
 */
export const computeProgress = (
    taken: Set<string>,
    byName: Map<string, Course>,
    requirements: Record<string, number>,
    englishTaken: Set<string> = new Set(),
): Progress => {
    const byCategory: Record<string, number> = {};
    let totalCredits = 0;
    let apCredits = 0;
    let ecCredits = 0;

    taken.forEach((name) => {
        const course = byName.get(name);
        if (!course) return;
        totalCredits += course.credits;
        apCredits += course.ap_credits;
        byCategory[course.category] = (byCategory[course.category] ?? 0) + course.credits;
        if (englishTaken.has(name)) ecCredits += course.credits;
    });

    const progress: RequirementProgress[] = Object.entries(requirements).map(
        ([key, required]) => {
            const earned = key === "ec" ? ecCredits : (byCategory[key] ?? 0);
            return {
                key,
                label: REQUIREMENT_LABEL[key] ?? key,
                earned,
                required,
                met: earned >= required,
            };
        },
    );

    return {
        totalCredits,
        apCredits,
        ecCredits,
        byCategory,
        requirements: progress,
        graduationReady: progress.every((item) => item.met),
    };
};

// ─── 평점 ────────────────────────────────────────────────────────────────────

/** 평어 선택지 — 높은 순 */
export const GRADE_OPTIONS = [
    "A+", "A0", "A-",
    "B+", "B0", "B-",
    "C+", "C0", "C-",
    "D+", "D0", "D-",
    "F",
];

export interface Gpa {
    /** 전체 평점 — 평어를 넣은 과목만 */
    overall: number | null;
    /** 자연과학 계열 평점 */
    natural: number | null;
    /** 평점에 반영된 학점 */
    gradedCredits: number;
    /** 평어를 아직 안 넣은 과목 수 (P/F 제외) */
    missing: number;
}

/**
 * 평점을 냅니다. 평어를 넣은 과목만 셈에 들어갑니다.
 *
 * P/F 과목은 평어가 있어도 제외합니다 — 등급이 아니라 통과 여부라 평점에 섞이면
 * 숫자가 왜곡됩니다.
 */
export const computeGpa = (
    grades: GradeMap,
    byName: Map<string, Course>,
    gradePoints: Record<string, number>,
    /** 평어를 넣을 수 있는 과목 전체 — 미입력 개수를 세는 데 씁니다 */
    scope: Set<string>,
): Gpa => {
    let points = 0;
    let credits = 0;
    let naturalPoints = 0;
    let naturalCredits = 0;

    Object.entries(grades).forEach(([name, grade]) => {
        const course = byName.get(name);
        if (!course || course.is_pf || !grade) return;
        const point = gradePoints[grade];
        if (point === undefined) return;
        points += point * course.credits;
        credits += course.credits;
        if (course.category === "natural") {
            naturalPoints += point * course.credits;
            naturalCredits += course.credits;
        }
    });

    const missing = [...scope].filter((name) => {
        const course = byName.get(name);
        return course && !course.is_pf && !grades[name];
    }).length;

    const round = (value: number) => Math.round(value * 100) / 100;
    return {
        overall: credits ? round(points / credits) : null,
        natural: naturalCredits ? round(naturalPoints / naturalCredits) : null,
        gradedCredits: credits,
        missing,
    };
};

// ─── 그래프 배치 ─────────────────────────────────────────────────────────────

export const NODE_WIDTH = 150;
export const NODE_HEIGHT = 50;
const COLUMN_GAP = 58;
const ROW_GAP = 12;

export interface GraphNode {
    name: string;
    course: Course;
    level: number;
    x: number;
    y: number;
}

export interface GraphEdge {
    before: string;
    after: string;
    alternative: boolean;
    path: string;
}

export interface Graph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    width: number;
    height: number;
}

/**
 * 과목의 단계를 정합니다 — 선수 체인을 거슬러 올라간 최대 깊이입니다.
 * 선수가 없으면 0단계이고, 원본 워크북처럼 왼쪽에서 오른쪽으로 흐릅니다.
 *
 * 데이터가 잘못돼 순환이 생겨도 멈추도록 방문 중인 과목은 건너뜁니다.
 */
const computeLevels = (
    names: string[],
    prereqIndex: Map<string, Prereq[]>,
    inScope: Set<string>,
): Map<string, number> => {
    const levels = new Map<string, number>();
    const visiting = new Set<string>();

    const resolve = (name: string): number => {
        const cached = levels.get(name);
        if (cached !== undefined) return cached;
        if (visiting.has(name)) return 0;

        visiting.add(name);
        const edges = (prereqIndex.get(name) ?? []).filter((edge) => inScope.has(edge.before));
        const level = edges.length
            ? Math.max(...edges.map((edge) => resolve(edge.before) + 1))
            : 0;
        visiting.delete(name);

        levels.set(name, level);
        return level;
    };

    names.forEach(resolve);
    return levels;
};

/**
 * 한 학과의 과목들을 좌→우 흐름으로 배치합니다.
 *
 * 같은 단계 안에서는 선수 과목의 세로 위치 평균에 가깝게 놓아 선이 덜 엉키게 합니다.
 *
 * `catalog`를 주면 다른 학과에 있는 선수 과목까지 왼쪽에 함께 그립니다. 융합 과목은
 * 선수가 전부 타 학과라, 이게 없으면 관계가 하나도 안 보이고 한 줄로 늘어섭니다.
 */
export const layoutGraph = (
    courses: Course[],
    prerequisites: Prereq[],
    catalog?: Map<string, Course>,
): Graph => {
    const primary = new Set(courses.map((course) => course.name));
    const byName = new Map(courses.map((course) => [course.name, course]));

    if (catalog) {
        prerequisites.forEach((edge) => {
            if (!primary.has(edge.after) || byName.has(edge.before)) return;
            const outside = catalog.get(edge.before);
            if (outside) byName.set(outside.name, outside);
        });
    }

    const names = [...byName.keys()];
    const inScope = new Set(names);
    const scopedEdges = prerequisites.filter(
        (edge) => inScope.has(edge.before) && inScope.has(edge.after),
    );
    const prereqIndex = buildPrereqIndex(scopedEdges);
    const levels = computeLevels(names, prereqIndex, inScope);

    const columns: string[][] = [];
    names.forEach((name) => {
        const level = levels.get(name) ?? 0;
        (columns[level] ??= []).push(name);
    });

    const positions = new Map<string, { x: number; y: number }>();
    columns.forEach((column, level) => {
        // 선수 과목이 놓인 높이의 평균 순으로 세워 선 교차를 줄입니다
        const ordered = [...column].sort((a, b) => {
            const anchor = (name: string) => {
                const parents = (prereqIndex.get(name) ?? [])
                    .map((edge) => positions.get(edge.before)?.y)
                    .filter((value): value is number => value !== undefined);
                return parents.length
                    ? parents.reduce((sum, value) => sum + value, 0) / parents.length
                    : Number.MAX_SAFE_INTEGER;
            };
            const diff = anchor(a) - anchor(b);
            return diff !== 0 ? diff : a.localeCompare(b);
        });

        ordered.forEach((name, row) => {
            positions.set(name, {
                x: level * (NODE_WIDTH + COLUMN_GAP),
                y: row * (NODE_HEIGHT + ROW_GAP),
            });
        });
    });

    const nodes: GraphNode[] = names.map((name) => {
        const position = positions.get(name)!;
        return {
            name,
            course: byName.get(name)!,
            level: levels.get(name) ?? 0,
            x: position.x,
            y: position.y,
        };
    });

    const edges: GraphEdge[] = scopedEdges.map((edge) => {
        const from = positions.get(edge.before)!;
        const to = positions.get(edge.after)!;
        const x1 = from.x + NODE_WIDTH;
        const y1 = from.y + NODE_HEIGHT / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_HEIGHT / 2;
        const bend = Math.max(24, (x2 - x1) / 2);
        return {
            before: edge.before,
            after: edge.after,
            alternative: edge.alternative,
            path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
        };
    });

    const width = columns.length * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP;
    const height = Math.max(...columns.map((column) => column.length), 1) * (NODE_HEIGHT + ROW_GAP) - ROW_GAP;

    return { nodes, edges, width: Math.max(width, NODE_WIDTH), height };
};
