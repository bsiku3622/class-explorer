import type { ExamSchedule, PersonalExam } from "./examsApi";

export interface ExamDay { date: string; label: string; exams: PersonalExam[]; }

/** 공지 명단에 시각이 겹치는 시험이 있으면 두 시험을 모두 유지하고 표시합니다. */
export function examConflictIds(exams: PersonalExam[]): Set<number> {
    const ids = new Set<number>();
    for (let i = 0; i < exams.length; i++) {
        const a = exams[i];
        if (!a.date || !a.start || !a.end) continue;
        for (const b of exams.slice(i + 1)) {
            if (a.date === b.date && b.start && b.end && a.start < b.end && b.start < a.end) {
                ids.add(a.id); ids.add(b.id);
            }
        }
    }
    return ids;
}

/** 학교 날짜는 기기의 시간대와 무관하게 표시합니다. */
export const examDateLabel = (date: string): string =>
    new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
        timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short",
    });

/** 시험이 없는 날도 한 칸 남겨 전체 시험 주간을 읽게 합니다. */
export function examDays(schedule: ExamSchedule): ExamDay[] {
    if (!schedule.period) return [];
    const start = Date.parse(`${schedule.period.start_date}T00:00:00Z`);
    const end = Date.parse(`${schedule.period.end_date}T00:00:00Z`);
    const days: ExamDay[] = [];
    for (let stamp = start; stamp <= end; stamp += 86_400_000) {
        const date = new Date(stamp).toISOString().slice(0, 10);
        days.push({ date, label: examDateLabel(date), exams: schedule.exams
            .filter((exam) => exam.date === date)
            .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "")) });
    }
    return days;
}
