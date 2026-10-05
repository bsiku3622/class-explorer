import api from "./api";
import { authHeader } from "./session";
import type { Term } from "../types";

export interface ExamPeriod {
    id: number;
    key: string;
    year: number;
    semester: number;
    kind: string;
    title: string;
    start_date: string;
    end_date: string;
    open: boolean;
}

export interface PersonalExam {
    id: number;
    subject: string;
    subject_english: string | null;
    date: string | null;
    start: string | null;
    end: string | null;
    duration: number | null;
    room: string | null;
    room_instruction: string | null;
    section: string | null;
    teacher: string | null;
    note: string | null;
}

export interface ExamSchedule {
    period: (ExamPeriod & { source_name: string }) | null;
    exams: PersonalExam[];
}

export async function fetchExamSchedule(term: Term | null, signal?: AbortSignal): Promise<ExamSchedule> {
    const response = await api.get<ExamSchedule>("/exams/me", {
        headers: authHeader(), params: term ?? undefined, signal,
    });
    return response.data;
}
