import type { SubjectData, Section, SectionTime, StudentInfo } from "../types";
import { DAYS_ORDER, DAY_MAP, getKoreanName, getSectionNumber } from "./utils";

/**
 * 수강 변경 탐색 엔진.
 *
 * 분반 이동 · 드랍 · 추가신청을 하나의 제약 탐색으로 처리합니다.
 * 과목마다 "가능한 최종 상태"의 후보 목록을 만들고, 시간 슬롯이 겹치지 않는
 * 조합을 백트래킹으로 찾습니다.
 */

/** `"MON-3"` 형태의 시간 슬롯 키 */
export type SlotKey = string;

export const toSlotKey = (day: string, period: number): SlotKey =>
    `${day}-${period}`;

export interface SectionInfo {
    id: number;
    subject: string;
    section: string;
    teacher: string;
    room: string;
    times: SectionTime[];
    slots: SlotKey[];
    students: StudentInfo[];
    studentCount: number;
    /** 과목 학점 — 교육과정에 없으면 null */
    credits: number | null;
}

/** 과목명 → 그 과목의 전체 분반 */
export type SubjectIndex = Map<string, SectionInfo[]>;

/** 과목에 지정할 수 있는 처리 방식 */
export type PlanAction = "keep" | "move" | "drop";

export interface PlanChoice {
    subject: string;
    /** 현재 듣는 분반. 신규 추가 과목이면 null */
    from: SectionInfo | null;
    /** 변경 후 분반. 드랍이면 null */
    to: SectionInfo | null;
}

export interface PlanResult {
    key: string;
    /** 변화가 있는 항목만 담습니다 (유지된 과목은 제외) */
    choices: PlanChoice[];
    moveCount: number;
    dropCount: number;
    addCount: number;
}

export interface PlanSearchResult {
    results: PlanResult[];
    /** 상한에 걸려 일부만 반환했는지 */
    truncated: boolean;
}

/** 결과 상한 — 조합이 폭발해도 UI가 감당할 수 있는 수준으로 자릅니다 */
export const MAX_PLAN_RESULTS = 200;

const sectionNumber = (section: string): number => {
    const match = section.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
};

const toSectionInfo = (
    subject: string,
    sec: Section,
    credits: number | null,
): SectionInfo => ({
    id: sec.id,
    subject,
    section: sec.section,
    teacher: sec.teacher,
    room: sec.room,
    times: sec.times || [],
    slots: (sec.times || []).map((t) => toSlotKey(t.day, t.period)),
    students: sec.students || [],
    studentCount: sec.student_count ?? sec.students?.length ?? 0,
    credits,
});

export const buildSubjectIndex = (allClassesData: SubjectData[]): SubjectIndex => {
    const index: SubjectIndex = new Map();
    allClassesData.forEach((subj) => {
        const sections = subj.sections
            .map((sec) => toSectionInfo(subj.subject, sec, subj.credits ?? null))
            .sort((a, b) => sectionNumber(a.section) - sectionNumber(b.section));
        index.set(subj.subject, sections);
    });
    return index;
};

/** 특정 학생이 듣는 분반 목록 */
export const getStudentSchedule = (
    allClassesData: SubjectData[],
    stuId: string,
): SectionInfo[] => {
    const result: SectionInfo[] = [];
    allClassesData.forEach((subj) => {
        subj.sections.forEach((sec) => {
            if (sec.students?.some((s) => s.stuId === stuId)) {
                result.push(toSectionInfo(subj.subject, sec, subj.credits ?? null));
            }
        });
    });
    return result.sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
};

/** 학생 학번 → 그 학생의 시간표. 여러 학생을 훑는 탐색에서 재조회를 피합니다 */
export type StudentIndex = Map<string, SectionInfo[]>;

export const buildStudentIndex = (allClassesData: SubjectData[]): StudentIndex => {
    const index: StudentIndex = new Map();
    allClassesData.forEach((subj) => {
        subj.sections.forEach((sec) => {
            const info = toSectionInfo(subj.subject, sec, subj.credits ?? null);
            sec.students?.forEach((s) => {
                const list = index.get(s.stuId);
                if (list) list.push(info);
                else index.set(s.stuId, [info]);
            });
        });
    });
    return index;
};

const conflicts = (slots: SlotKey[], used: Set<SlotKey>): boolean =>
    slots.some((s) => used.has(s));

export interface TradePartner {
    stuId: string;
    name: string;
    /** 상대가 내주게 될 분반 (= 내가 가고 싶은 곳) */
    gives: SectionInfo;
    /** 상대가 받게 될 분반 (= 내 현재 자리) */
    takes: SectionInfo;
}

/**
 * 나와 분반을 맞바꿀 수 있는 학생을 찾습니다.
 *
 * 상대가 내가 가고 싶은 분반(`to`)을 듣고 있고, 내 분반(`from`)으로 옮겨도
 * 상대 시간표에 충돌이 없는 경우만 남깁니다.
 *
 * 여기서 검사하는 것은 **상대 쪽 성립 여부뿐**입니다. 내가 `to`로 갈 수 있는지는
 * 호출하는 쪽에서 이미 확인된 상태여야 합니다 (조합 탐색 결과이거나
 * `findBlockers`가 비어 있는 분반). 그 전제 없이 부르면 한쪽만 성립하는
 * 조합까지 상대로 잡힙니다.
 */
export const findTradePartners = (
    studentIndex: StudentIndex,
    myStuId: string,
    from: SectionInfo,
    to: SectionInfo,
): TradePartner[] => {
    const partners: TradePartner[] = [];

    to.students.forEach((student) => {
        if (student.stuId === myStuId) return;

        const theirSchedule = studentIndex.get(student.stuId);
        if (!theirSchedule) return;

        const busy = new Set<SlotKey>();
        theirSchedule.forEach((s) => {
            if (s.id === to.id) return; // 맞바꿀 분반은 비워집니다
            s.slots.forEach((slot) => busy.add(slot));
        });

        if (conflicts(from.slots, busy)) return;
        partners.push({
            stuId: student.stuId,
            name: student.name,
            gives: to,
            takes: from,
        });
    });

    return partners.sort((a, b) => a.stuId.localeCompare(b.stuId));
};

/** 두 분반이 시간상 겹치는지 */
export const sectionsOverlap = (a: SectionInfo, b: SectionInfo): boolean => {
    const set = new Set(a.slots);
    return b.slots.some((s) => set.has(s));
};

/**
 * 어떤 분반을 시간표에 넣으려 할 때 부딪히는 기존 과목들.
 * 추가신청 가능 여부와 "무엇을 비워야 하는지"를 판정하는 데 씁니다.
 */
export const findBlockers = (
    schedule: SectionInfo[],
    candidate: SectionInfo,
): SectionInfo[] =>
    schedule.filter(
        (s) => s.subject !== candidate.subject && sectionsOverlap(s, candidate),
    );

interface Variable {
    subject: string;
    from: SectionInfo | null;
    candidates: (SectionInfo | null)[];
}

export interface AddSelection {
    subject: string;
    /** 특정 분반으로 고정. null이면 모든 분반이 후보 */
    sectionId: number | null;
}

export interface PlanRequest {
    schedule: SectionInfo[];
    index: SubjectIndex;
    /** 과목명 → 처리 방식. 지정하지 않은 과목은 `keep` */
    actions: Record<string, PlanAction>;
    /** 새로 넣고 싶은 과목 (분반 고정 가능) */
    addSelections: AddSelection[];
    /**
     * `move`로 표시한 과목의 목표 분반. 값이 없거나 null이면 모든 분반을 탐색합니다.
     * 특정 분반을 지정하면 그 분반만 후보가 됩니다.
     */
    moveTargets?: Record<string, number | null>;
}

/**
 * 조건을 만족하는 수강 조합을 찾습니다.
 *
 * - `keep` 과목의 시간은 고정 제약이 됩니다
 * - `move` 과목은 같은 과목의 다른 분반(현재 분반 포함)이 후보
 * - `drop` 과목은 시간표에서 빠집니다
 * - 추가 과목은 해당 과목의 모든 분반이 후보이며 반드시 편성되어야 합니다
 *
 * 변화가 전혀 없는 조합(전부 현재 분반 유지)은 결과에서 제외합니다.
 */
export const findPlans = (
    request: PlanRequest,
    limit: number = MAX_PLAN_RESULTS,
): PlanSearchResult => {
    const { schedule, index, actions, addSelections, moveTargets } = request;

    const fixedSlots = new Set<SlotKey>();
    const variables: Variable[] = [];

    schedule.forEach((current) => {
        const action = actions[current.subject] ?? "keep";
        if (action === "keep") {
            current.slots.forEach((s) => fixedSlots.add(s));
            return;
        }
        if (action === "drop") {
            variables.push({
                subject: current.subject,
                from: current,
                candidates: [null],
            });
            return;
        }
        const all = index.get(current.subject) ?? [current];
        const target = moveTargets?.[current.subject];
        const candidates =
            target == null ? all : all.filter((s) => s.id === target);
        variables.push({
            subject: current.subject,
            from: current,
            candidates: candidates.length > 0 ? candidates : all,
        });
    });

    const enrolledSubjects = new Set(schedule.map((s) => s.subject));
    addSelections.forEach(({ subject, sectionId }) => {
        if (enrolledSubjects.has(subject)) return;
        const all = index.get(subject);
        if (!all || all.length === 0) return;
        const candidates =
            sectionId === null ? all : all.filter((s) => s.id === sectionId);
        if (candidates.length === 0) return;
        variables.push({ subject, from: null, candidates });
    });

    if (variables.length === 0) return { results: [], truncated: false };

    // 후보가 적은 변수부터 배치하면 불가능한 가지를 일찍 잘라냅니다
    const ordered = [...variables].sort(
        (a, b) => a.candidates.length - b.candidates.length,
    );

    const results: PlanResult[] = [];
    let truncated = false;
    const picked: (SectionInfo | null)[] = new Array(ordered.length).fill(null);

    const record = () => {
        const choices: PlanChoice[] = [];
        let moveCount = 0;
        let dropCount = 0;
        let addCount = 0;

        ordered.forEach((variable, i) => {
            const to = picked[i];
            const from = variable.from;
            if (from && to && from.id === to.id) return; // 유지 — 결과에 싣지 않음

            if (!from && to) addCount++;
            else if (from && !to) dropCount++;
            else moveCount++;

            choices.push({ subject: variable.subject, from, to });
        });

        if (choices.length === 0) return; // 변화 없음

        choices.sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
        results.push({
            key: choices.map((c) => `${c.subject}:${c.to?.id ?? "x"}`).join("|"),
            choices,
            moveCount,
            dropCount,
            addCount,
        });
    };

    const backtrack = (depth: number, used: Set<SlotKey>) => {
        if (results.length >= limit) {
            truncated = true;
            return;
        }
        if (depth === ordered.length) {
            record();
            return;
        }

        for (const candidate of ordered[depth].candidates) {
            if (candidate && conflicts(candidate.slots, used)) continue;

            picked[depth] = candidate;
            if (candidate) candidate.slots.forEach((s) => used.add(s));

            backtrack(depth + 1, used);

            if (candidate) candidate.slots.forEach((s) => used.delete(s));
            picked[depth] = null;

            if (results.length >= limit) {
                truncated = true;
                return;
            }
        }
    };

    backtrack(0, new Set(fixedSlots));

    results.sort((a, b) => {
        const changeA = a.moveCount + a.dropCount;
        const changeB = b.moveCount + b.dropCount;
        if (changeA !== changeB) return changeA - changeB;
        return a.key.localeCompare(b.key);
    });

    return { results, truncated };
};

export interface AddCandidate {
    section: SectionInfo;
    /** 이 분반을 넣으려면 비워야 하는 기존 과목들. 비어 있으면 바로 추가 가능 */
    blockers: SectionInfo[];
}

/**
 * 특정 과목의 각 분반이 현재 시간표에 들어갈 수 있는지 판정합니다.
 * 막혀 있다면 어떤 과목이 걸리는지 함께 돌려줍니다.
 */
export const evaluateAddCandidates = (
    schedule: SectionInfo[],
    index: SubjectIndex,
    subject: string,
): AddCandidate[] => {
    const sections = index.get(subject) ?? [];
    return sections.map((section) => ({
        section,
        blockers: findBlockers(schedule, section),
    }));
};

/**
 * 지정한 과목들을 뺐을 때 새로 들어갈 수 있는 과목·분반 목록.
 * 이미 수강 중인 과목은 후보에서 제외합니다.
 */
export const findAddableAfterDrop = (
    schedule: SectionInfo[],
    index: SubjectIndex,
    dropSubjects: string[],
): SectionInfo[] => {
    const dropped = new Set(dropSubjects);
    const remaining = schedule.filter((s) => !dropped.has(s.subject));
    const usedSlots = new Set<SlotKey>();
    remaining.forEach((s) => s.slots.forEach((slot) => usedSlots.add(slot)));

    const enrolled = new Set(schedule.map((s) => s.subject));
    const addable: SectionInfo[] = [];

    index.forEach((sections, subject) => {
        if (enrolled.has(subject)) return;
        sections.forEach((section) => {
            if (section.slots.length === 0) return;
            if (!conflicts(section.slots, usedSlots)) addable.push(section);
        });
    });

    return addable.sort(
        (a, b) =>
            a.subject.localeCompare(b.subject, "ko") ||
            sectionNumber(a.section) - sectionNumber(b.section),
    );
};

/** 시간표를 요일·교시 순으로 정렬된 슬롯 목록으로 (그리드 렌더링용) */
export const scheduleToTimes = (sections: SectionInfo[]): SectionTime[] =>
    sections
        .flatMap((s) =>
            s.times.map((t) => ({
                ...t,
                subject: s.subject,
                section: s.section,
                teacher: s.teacher,
            })),
        )
        .sort(
            (a, b) =>
                DAYS_ORDER.indexOf(a.day as (typeof DAYS_ORDER)[number]) -
                    DAYS_ORDER.indexOf(b.day as (typeof DAYS_ORDER)[number]) ||
                a.period - b.period,
        );

/** 조합을 적용한 뒤의 최종 시간표 */
export const applyPlan = (
    schedule: SectionInfo[],
    plan: PlanResult,
): SectionInfo[] => {
    const changed = new Map(plan.choices.map((c) => [c.subject, c.to]));
    const result: SectionInfo[] = [];

    schedule.forEach((s) => {
        if (!changed.has(s.subject)) {
            result.push(s);
            return;
        }
        const to = changed.get(s.subject);
        if (to) result.push(to);
        changed.delete(s.subject);
    });

    // 신규 추가 과목
    changed.forEach((to) => {
        if (to) result.push(to);
    });

    return result.sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
};

/** 시간표의 총 학점. 교육과정에 없는 과목은 0으로 셉니다 */
export const totalCredits = (sections: SectionInfo[]): number =>
    sections.reduce((sum, s) => sum + (s.credits ?? 0), 0);

/** 학점이 없어 합계에서 빠진 과목 */
export const missingCreditSubjects = (sections: SectionInfo[]): string[] =>
    sections.filter((s) => s.credits == null).map((s) => s.subject);

/**
 * 구인 글에 쓰는 짧은 시간 표기. "월67 목9"
 * 10교시 이상이 섞이면 붙여 쓸 수 없어 콤마로 나눕니다 ("화10,11").
 */
export const compactTimes = (times: SectionTime[]): string => {
    const byDay: Record<string, number[]> = {};
    times.forEach((t) => {
        (byDay[t.day] ??= []).push(t.period);
    });
    return DAYS_ORDER.filter((day) => byDay[day])
        .map((day) => {
            const periods = byDay[day].sort((a, b) => a - b);
            const joined = periods.some((p) => p >= 10)
                ? periods.join(",")
                : periods.join("");
            return `${DAY_MAP[day]}${joined}`;
        })
        .join(" ");
};

/** 분반 교환 상대를 구하는 글. 그대로 복사해 붙여넣을 수 있는 형태입니다 */
export const buildTradePost = (
    subject: string,
    from: SectionInfo,
    to: SectionInfo,
): string => {
    const mine = `${getSectionNumber(from.section)}분반(${compactTimes(from.times)})`;
    const theirs = `${getSectionNumber(to.section)}분반(${compactTimes(to.times)})`;
    return [
        `${getKoreanName(subject)} 트레이드 구합니다.`,
        `나: ${mine} -> ${theirs}`,
        `너: ${theirs} -> ${mine}`,
    ].join("\n");
};

// ─── 계획 상태 ────────────────────────────────────────────────────────────────

/**
 * 화면이 들고 있는 "무엇을 어떻게 바꾸겠다" — `/trade` 가 계정에 저장하고,
 * **홈이 같은 값을 읽어** 계획 시간표를 그립니다.
 */
export interface PlanState {
    /** 과목명 → 처리 방식. 없으면 `keep` */
    actions: Record<string, PlanAction>;
    addSelections: AddSelection[];
    moveTargets: Record<string, number | null>;
}

/** `userState` 의 `trade` 키에 저장되는 모양 */
export interface SavedTradePlan extends PlanState {
    stuId: string | null;
    /**
     * 조합 목록에서 고른 것(`PlanResult.key`). 없으면 자동(첫 조합)입니다.
     *
     * 이걸 같이 저장하는 이유는 **홈이 트레이드 화면과 같은 시간표를 그려야** 하기
     * 때문입니다 — 화면마다 첫 조합을 각자 고르면 같은 계획인데 다른 결과가 됩니다.
     */
    previewKey?: string | null;
}

/** 계정 저장으로 옮기기 전에 쓰던 localStorage 키 — 남아 있으면 한 번 옮겨 옵니다 */
export const TRADE_STATE_LEGACY_KEY = "ksa_trade_state";

/** 분반을 직접 고르지 않고 "자동"으로 둔 항목이 있는지 */
export const hasAutoChoice = (schedule: SectionInfo[], state: PlanState): boolean =>
    state.addSelections.some((a) => a.sectionId === null) ||
    schedule.some(
        (s) =>
            (state.actions[s.subject] ?? "keep") === "move" &&
            state.moveTargets[s.subject] == null,
    );

export interface PlannedSchedule {
    /** 계획을 반영한 시간표 */
    sections: SectionInfo[];
    /** 새로 들어온 과목 */
    entering: Set<string>;
    /** 분반이 바뀐 과목 */
    moved: Set<string>;
    /** 고정한 분반과 시간이 부딪히는 기존 과목 */
    conflicting: Set<string>;
}

/**
 * 계획을 적용한 시간표.
 *
 * 조합(`plan`)을 넘기면 그 결과를, 안 넘기면 지금까지 지정한 드랍·추가·이동을 바로
 * 반영합니다. **드랍한 과목은 그리지 않습니다** — 어느 시간이 비는지는 칸이 비어야
 * 가장 잘 보입니다. 남겨 두면 새로 넣을 자리가 여전히 차 있어 보입니다.
 *
 * ⚠️ **트레이드 화면과 홈이 이 함수 하나를 같이 씁니다.** 각자 계산하면 같은 계획인데
 * 두 화면의 시간표가 갈라집니다.
 */
export const buildPlannedSchedule = (
    schedule: SectionInfo[],
    index: SubjectIndex,
    state: PlanState,
    plan: PlanResult | null,
): PlannedSchedule => {
    const { actions, addSelections, moveTargets } = state;
    const leaving = new Set<string>();
    const entering = new Set<string>();
    const moved = new Set<string>();
    const conflicting = new Set<string>();

    if (plan) {
        plan.choices.forEach((c) => {
            if (!c.to) leaving.add(c.subject);
            else if (!c.from) entering.add(c.subject);
            else if (c.from.id !== c.to.id) moved.add(c.subject);
        });
        return {
            sections: applyPlan(schedule, plan),
            entering,
            moved,
            conflicting, // 성립한 조합이라 충돌이 없습니다
        };
    }

    schedule.forEach((s) => {
        if ((actions[s.subject] ?? "keep") === "drop") leaving.add(s.subject);
    });

    // 목표 분반을 고른 이동은 그 자리로 옮겨 그립니다
    const movedTo = new Map<string, SectionInfo>();
    schedule.forEach((s) => {
        if ((actions[s.subject] ?? "keep") !== "move") return;
        const targetId = moveTargets[s.subject];
        if (targetId == null || targetId === s.id) return;
        const target = (index.get(s.subject) ?? []).find((x) => x.id === targetId);
        if (target) movedTo.set(s.subject, target);
    });

    const staying = schedule
        .filter((s) => !leaving.has(s.subject))
        .map((s) => movedTo.get(s.subject) ?? s);
    movedTo.forEach((_, subject) => moved.add(subject));

    // 옮겨간 분반이 다른 과목과 부딪히는지
    movedTo.forEach((target, subject) => {
        findBlockers(
            staying.filter((s) => s.subject !== subject),
            target,
        ).forEach((b) => conflicting.add(b.subject));
    });

    const added: SectionInfo[] = [];
    addSelections.forEach(({ subject, sectionId }) => {
        if (sectionId === null) return; // 분반 미정이면 그릴 수 없습니다
        const section = (index.get(subject) ?? []).find((s) => s.id === sectionId);
        if (!section) return;
        added.push(section);
        entering.add(subject);
        // 충돌을 감수하고 고정했다면, 부딪히는 기존 과목을 짚어줍니다
        findBlockers(staying, section).forEach((b) => conflicting.add(b.subject));
    });

    return { sections: [...staying, ...added], entering, moved, conflicting };
};

/**
 * 계획이 실제로 시간표를 바꾸는가. 분반 id 집합만 봅니다 — 순서는 뜻이 없습니다.
 * 홈은 이게 false 면 전환 토글 자체를 띄우지 않습니다.
 */
export const sameSections = (a: SectionInfo[], b: SectionInfo[]): boolean => {
    if (a.length !== b.length) return false;
    const ids = new Set(a.map((s) => s.id));
    return b.every((s) => ids.has(s.id));
};
