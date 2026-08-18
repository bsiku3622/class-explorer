import type { Role } from "../types";

export const DAY_MAP: Record<string, string> = {
    MON: "월",
    TUE: "화",
    WED: "수",
    THU: "목",
    FRI: "금",
};

export const DAYS_ORDER = ["MON", "TUE", "WED", "THU", "FRI"] as const;

export const PERIODS = Array.from({ length: 11 }, (_, i) => i + 1);

/**
 * 검색어에서 prefix(:) 및 논리 연산자를 제거하고 순수 검색 키워드 배열을 반환합니다.
 * SectionCard, SubjectAccordionItem 등 하이라이팅에 사용됩니다.
 */
export const extractSearchTerms = (searchTerm: string): string[] => {
    if (!searchTerm) return [];
    const clean = searchTerm.trim();
    let query = clean;
    if (clean.includes(":")) {
        const parts = clean.split(":", 2);
        query = parts[1].trim();
    }
    return query
        .split(/[+&/()!]/)
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k !== "");
};

/**
 * 학번(studentId)의 앞 두 자리를 분석하여 해당하는 고유 색상 코드를 반환합니다.
 * @param studentId "23-123" 형식의 문자열
 * @returns Hex color string
 */
/**
 * 학과별 색. 홈의 **주간 격자·자·오늘 목록·히어로가 같이 씁니다** — 한 화면에서
 `일반지구과학` 이 자리마다 다른 색이면 색이 정보가 아니라 장식이 됩니다.
 *
 * ⚠️ **핑크(`retro-primary`) 계열은 넣지 마세요.** 그건 "지금" 한 뜻으로 예약된
 * 색입니다. 학과색은 8~12% 로만 깔고 지금만 100% 로 채우기 때문에 섞이지 않습니다.
 */
const DEPARTMENT_COLOR: Record<string, string> = {
    수학: "#7828c8",
    정보과학: "#2563eb",
    물리학: "#4f46e5",
    화학: "#ea580c",
    생물학: "#16a34a",
    지구과학: "#0d9488",
    국어: "#dc2626",
    사회: "#b45309",
    외국어: "#0891b2",
    예체능: "#ca8a04",
    융합: "#64748b",
};

/** 교육과정에 없는 과목(외국인 전형 등)은 `department` 가 `null` 로 옵니다 */
export const getDepartmentColor = (department: string | null | undefined): string =>
    (department && DEPARTMENT_COLOR[department]) || "#64748b";

/**
 * `#7828c8` + 0.08 → `rgba(120,40,200,0.08)`.
 *
 * **회색으로 죽이지 말고 투명도로 낮춥니다.** 지난 수업을 회색으로 칠하면 하루가
 * 잿빛이 되지만, 같은 색을 옅게 깔면 **무슨 과목이었는지가 남습니다.**
 */
export const withAlpha = (hex: string, alpha: number): string => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export const getStudentColor = (studentId: string): string => {
    const year = studentId.split("-")[0];

    // 여기서 색상을 커스텀할 수 있습니다.
    const colorMap: Record<string, string> = {
        "23": "#7828C8", // Purple (오렌지색과 명확히 구분됨)
        "24": "#FC8200", // Orange
        "25": "#00B327", // Green
        // '26': '#3decfd', // Cyan/Blue
        "26": "#00B5E7", // Cyan/Blue
    };

    return colorMap[year] || "#000000"; // 기본값은 검정
};

/**
 * 문자열 내 로마 숫자(Ⅰ~Ⅻ)를 아라비아 숫자로 변환합니다.
 * 예) "영어Ⅲ" → "영어3", "미적분학Ⅱ" → "미적분학2"
 */
const ROMAN_MAP: [string, string][] = [
    ["Ⅻ", "12"], ["Ⅺ", "11"], ["Ⅹ", "10"],
    ["Ⅸ", "9"], ["Ⅷ", "8"], ["Ⅶ", "7"], ["Ⅵ", "6"],
    ["Ⅴ", "5"], ["Ⅳ", "4"], ["Ⅲ", "3"], ["Ⅱ", "2"], ["Ⅰ", "1"],
];

export const replaceRomanNumerals = (str: string): string => {
    let result = str;
    for (const [roman, arabic] of ROMAN_MAP) {
        result = result.replaceAll(roman, arabic);
    }
    return result;
};

/**
 * 과목명에서 영문 이름 괄호를 제거하고 한글명만 반환합니다.
 * - 소문자 라틴 문자를 포함한 괄호 → 제거 (영문 과목명)
 * - 소문자 없는 괄호 → 유지 (예: (EC) 특수과목 태그)
 * 예) "영어Ⅲ(English III)" → "영어Ⅲ"
 *     "한국과목(EC)(English Name)" → "한국과목(EC)"
 */
export const getKoreanName = (subject: string): string => {
    if (!subject) return "";
    // Step 1: 중첩 괄호 정규화 — (TAG(English Name)) → (TAG)
    //   예) (EC(Basic Analytical Chemistry)) → (EC)
    let result = subject.replace(/\(([A-Z]+)\([^)]*\)\)/g, "($1)");
    // Step 2: 소문자 라틴 포함 단순 괄호 제거 — (English Name) → ""
    //   (EC) 처럼 소문자 없는 괄호는 유지
    result = result.replace(/\([^()]*[a-z][^()]*\)/g, "");
    return result.trim();
};

/**
 * 분반 정보에서 숫자만 추출합니다. (예: "제1분반" -> "1")
 */
export const getSectionNumber = (section: string): string => {
    if (!section) return "";
    const match = section.match(/\d+/);
    return match ? match[0] : section;
};

/**
 * 과목명과 분반 정보를 결합하여 포맷팅합니다.
 * @param subject 과목명
 * @param sections 분반 리스트
 * @param extra 추가 정보 (선생님 혹은 교실)
 * @param extraPosition 추가 정보의 위치 ('prefix' 혹은 'suffix')
 * @returns 포맷팅된 문자열
 */
export const formatSubjectWithSection = (
    subject: string,
    sections: string[],
    extra?: string,
    extraPosition: "prefix" | "suffix" = "prefix"
): string => {
    const korean = getKoreanName(subject);
    const uniqueSections = Array.from(new Set(sections.map(getSectionNumber)))
        .sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b);
            return numA - numB;
        });
    
    const sectionStr = uniqueSections.join(",");
    const subjectPart = `${korean}(${sectionStr})`;
    
    if (!extra) return subjectPart;
    
    return extraPosition === "prefix" 
        ? `${extra} - ${subjectPart}` 
        : `${subjectPart} - ${extra}`;
};

/**
 * 시간표 정보(times)를 "화2, 수3,4" 형식으로 포맷팅합니다.
 * @param times 요일과 교시 정보 리스트
 * @returns 포맷팅된 문자열
 */
export const formatSectionTimes = (
    times: { day: string; period: number }[] | undefined,
): string => {
    if (!times || times.length === 0) return "";

    const grouped: Record<string, number[]> = {};
    times.forEach((t) => {
        if (!grouped[t.day]) grouped[t.day] = [];
        grouped[t.day].push(t.period);
    });

    return DAYS_ORDER.filter((day) => grouped[day])
        .map((day) => {
            const periods = grouped[day].sort((a, b) => a - b).join(",");
            return `${DAY_MAP[day]}${periods}`;
        })
        .join(", ");
};

/**
 * 권한 검사. 권한은 위계라서 admin 은 manager 검사도 통과합니다.
 *
 * `role === "admin"` 처럼 직접 비교하면 매니저를 빠뜨리기 쉬워서 여기로 모읍니다.
 */
const ROLE_RANK: Record<Role, number> = { user: 0, manager: 1, admin: 2 };

export const hasRole = (role: Role | undefined | null, minimum: Role): boolean =>
    ROLE_RANK[role ?? "user"] >= ROLE_RANK[minimum];

/**
 * 자정 기준 분 → `"14:05"`.
 *
 * 교시 시각(`backend/periods.py`)이 자정 기준 분으로 오고, 홈의 시계·캐럿도 같은
 * 단위로 셉니다 — 화면마다 따로 포맷하면 `9:5` 같은 게 섞여 나옵니다.
 */
export const hhmm = (minute: number): string =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/**
 * 이 색 위에 올릴 글자색 (검정 아니면 흰색).
 *
 * 색을 꽉 채우는 면(선택된 버튼 등)은 색마다 밝기가 달라서 글자색을 하나로 고정하면
 * 어딘가는 반드시 안 읽힙니다 — 노랑 위의 흰 글씨, 보라 위의 검은 글씨.
 */
export const readableInk = (hex: string): string => {
    const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "#000000" : "#ffffff";
};
