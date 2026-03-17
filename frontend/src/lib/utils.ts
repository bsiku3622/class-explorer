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
