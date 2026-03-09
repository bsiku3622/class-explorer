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

    return colorMap[year] || "rgba(0, 0, 0, 0.1)"; // 기본값은 투명한 검정 테두리
};
