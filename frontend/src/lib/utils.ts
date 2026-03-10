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
 * 과목명에서 한글명만 추출합니다.
 */
export const getKoreanName = (subject: string): string => {
    if (!subject) return "";
    return subject.split("(")[0].trim();
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

    const dayMap: Record<string, string> = {
        MON: "월",
        TUE: "화",
        WED: "수",
        THU: "목",
        FRI: "금",
    };

    const grouped: Record<string, number[]> = {};
    times.forEach((t) => {
        if (!grouped[t.day]) grouped[t.day] = [];
        grouped[t.day].push(t.period);
    });

    const daysOrder = ["MON", "TUE", "WED", "THU", "FRI"];
    return daysOrder
        .filter((day) => grouped[day])
        .map((day) => {
            const periods = grouped[day].sort((a, b) => a - b).join(",");
            return `${dayMap[day]}${periods}`;
        })
        .join(", ");
};
