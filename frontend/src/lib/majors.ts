/**
 * 전공 — 학교 공식 이름은 **심화필수 전공 트랙**입니다. 묻는 창(`MajorPrompt`)·`/about`·학사일정·
 * Admin 이 같이 씁니다.
 *
 * 트랙은 교육과정의 과학 여섯 학과이고 학부 셋으로 묶입니다(인문예술학부는 트랙이 없습니다).
 * **원본은 서버**(`backend/services/majors.py`)이고, `MAJOR_DIVISIONS` 는 일정 입력 창의 칩과 표기에
 * 쓰는 사본입니다 — 학교가 트랙을 바꾸면 둘 다 고칩니다. 고르는 창은 서버가 주는 목록(`GET /majors`)을
 * 그대로 그려서 심화필수 조건까지 같이 받습니다.
 *
 * 1·2학년 때 학교가 조사하고 **3학년 2학기까지 바꿀 수 있어서**, 한 번 고른 값도 `/about` 에서
 * 언제든 고칩니다.
 */

import api from "./api";
import { todayInKorea } from "./factsApi";
import { authHeader } from "./session";

export const MAJOR_DIVISIONS: { division: string; majors: string[] }[] = [
    { division: "수리정보과학부", majors: ["수학", "정보과학"] },
    { division: "물리지구과학부", majors: ["물리학", "지구과학"] },
    { division: "화학생물학부", majors: ["화학", "생물학"] },
];

const MAJOR_ORDER = MAJOR_DIVISIONS.flatMap((d) => d.majors);

export interface MajorOption {
    name: string;
    /** 심화필수 조건 — `"자료구조, 정보과학3, 알고리즘을 수강해야 함"`. 교육과정에 없으면 `null` */
    requirement: string | null;
}

export interface MajorDivision {
    division: string;
    majors: MajorOption[];
}

export interface MyMajor {
    /** 트랙 이름. 비었으면 아직 안 골랐거나 "아직 정하지 않았어요" 를 고른 것 */
    major: string | null;
    division: string | null;
    /** 고르거나 "아직 정하지 않았어요" 를 눌렀으면 `true` — 그 뒤로는 묻는 창이 안 뜹니다 */
    answered: boolean;
}

/**
 * 수강 이력으로 짐작한 트랙. **짐작일 뿐입니다** — 맞는지 대 볼 정답이 없고, 수집된 학기가 짧아
 * 윗 학번도 열에 서넛은 짐작이 안 나옵니다. 그래서 화면은 "추천" 표식만 달고, 저장은 사람이 직접
 * 눌러야 합니다.
 */
export interface MajorSuggestion {
    major: string;
    division: string | null;
    /** 그렇게 본 근거 — 그 학과의 심화·AP 과목 (최대 4개) */
    courses: string[];
}

export interface MajorsInfo {
    options: MajorDivision[];
    me: MyMajor;
    /** 아직 안 골랐을 때만 옵니다 */
    suggestion: MajorSuggestion | null;
}

/** 조사 현황 — **인원 수만** 옵니다. 누가 무엇을 골랐는지는 서버도 내보내지 않습니다 */
export interface MajorStats {
    /** 학번을 확인한 계정 수 (시연 계정 제외) */
    students: number;
    unanswered: number;
    undecided: number;
    divisions: { division: string; majors: { name: string; count: number }[] }[];
}

export const fetchMajors = async (): Promise<MajorsInfo> => {
    const { data } = await api.get("/majors", { headers: authHeader() });
    return data;
};

/** `null` 은 "아직 정하지 않았어요" — 그래도 답한 것으로 칩니다 */
export const saveMajor = async (major: string | null): Promise<MyMajor> => {
    const { data } = await api.put("/majors/me", { major }, { headers: authHeader() });
    return data;
};

export const fetchMajorStats = async (): Promise<MajorStats> => {
    const { data } = await api.get("/majors/stats", { headers: authHeader() });
    return data;
};

/**
 * 대상 전공 표기 — 학부가 통째로 들어 있으면 학부 이름으로 접습니다.
 * `["물리학", "지구과학"]` → `"물리지구과학부"`, `["물리학", "화학"]` → `"물리학·화학"`.
 * 빈 배열은 전공 무관이라 아무것도 안 씁니다(학년의 `gradeLabel` 과 같은 관례).
 */
export const majorLabel = (majors: string[] | undefined): string => {
    if (!majors?.length) return "";
    return MAJOR_DIVISIONS.flatMap(({ division, majors: pair }) => {
        const picked = pair.filter((m) => majors.includes(m));
        return picked.length === pair.length ? [division] : picked;
    }).join("·");
};

/**
 * 칩을 눌렀을 때의 다음 선택 — `names` 가 다 골라져 있으면 빼고, 아니면 채웁니다. 학부 칩은 두
 * 트랙을 한꺼번에 넘깁니다. 순서는 늘 학부 순서로 맞춥니다.
 */
export const toggleMajors = (selected: string[], names: string[]): string[] => {
    const next = names.every((n) => selected.includes(n))
        ? selected.filter((m) => !names.includes(m))
        : [...new Set([...selected, ...names])];
    return MAJOR_ORDER.filter((m) => next.includes(m));
};

// ── 묻는 창 미루기 ───────────────────────────────────────────────────────────
// "나중에" 는 **그날 하루만** 미룹니다. 계정마다 따로 적습니다 — 한 브라우저를 둘이 쓰면 앞사람이
// 미룬 게 뒷사람의 창까지 막습니다.
const snoozeKey = (userId: number) => `ksa_major_prompt_snoozed_${userId}`;

export const isMajorPromptSnoozed = (userId: number): boolean => {
    try {
        return localStorage.getItem(snoozeKey(userId)) === todayInKorea();
    } catch {
        return false;
    }
};

export const snoozeMajorPrompt = (userId: number): void => {
    try {
        localStorage.setItem(snoozeKey(userId), todayInKorea());
    } catch {
        // 저장소가 막힌 브라우저 — 이번 화면에서만 닫힙니다
    }
};
