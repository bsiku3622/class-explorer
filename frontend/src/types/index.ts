export interface Term {
    year: number;
    semester: number;
}

/**
 * 계정 권한. **위계입니다** — admin 은 manager 가 하는 일을 전부 할 수 있습니다.
 * 비교는 직접 하지 말고 `hasRole()` 을 쓰세요.
 */
export type Role = "user" | "manager" | "admin";

/** 일정을 어떻게 적었는지. 학사일정은 전부 종일이고 개인 일정만 시각·교시를 씁니다 */
export type TimeMode = "allday" | "clock" | "period";

export type EventCategory =
    | "holiday"
    | "dorm"
    | "exam"
    | "term"
    | "academic"
    | "event";

export interface CalendarEvent {
    id: number;
    title: string;
    /** YYYY-MM-DD. 하루짜리여도 end_date 가 채워져 있습니다 */
    start_date: string;
    end_date: string;
    time_mode: TimeMode;
    start_minute: number | null;
    end_minute: number | null;
    start_period: number | null;
    end_period: number | null;
    category: EventCategory;
    /** [1,2] 처럼. 비어 있으면 전학년 */
    target_grades: number[];
    /** pdf = 학사일정 문서에서 온 것 */
    source: "pdf" | "manual";
    /** true 면 내 개인 일정 — 나만 보이고 나만 고칩니다 */
    is_personal: boolean;
    /** 같은 반복 묶음이면 같은 값 */
    series_id: string | null;
    note: string | null;
}

export interface EventRequest {
    id: number;
    title: string;
    start_date: string;
    end_date: string;
    time_mode: TimeMode;
    start_minute: number | null;
    end_minute: number | null;
    start_period: number | null;
    end_period: number | null;
    category: EventCategory;
    target_grades: number[];
    note: string | null;
    status: "pending" | "approved" | "rejected";
    reason: string | null;
    requested_by: string;
    created_at: string;
}

export interface StudentInfo {
    stuId: string;
    name: string;
}

export interface SectionTime {
    day: string;
    period: number;
    room: string;
    subject?: string;
    section?: string;
    teacher?: string;
}

export interface Section {
    id: number;
    section: string;
    teacher: string;
    room: string;
    students: StudentInfo[];
    student_count: number;
    times: SectionTime[];
}

export interface SubjectData {
    /**
     * 화면에 그대로 쓰는 과목명. 영문명은 이미 빠져 있고, 영어강의는 뒤에 `(EC)`가
     * 붙어 한국어강의와 구분됩니다 — 둘은 따로 개설되는 별개 과목입니다.
     */
    subject: string;
    /** 개설 과목 id. 이름이 같은 영어·한국어강의를 가르는 진짜 키입니다 */
    subject_id: number;
    subject_english?: string | null;
    /** 영어강의(English Class) 여부 */
    is_ec?: boolean;
    subject_student_count: number;
    section_count: number;
    sections: Section[];
    /** 학점 — 교육과정에 없는 과목(외국인 전형·개편 전 이름)은 null */
    credits?: number | null;
    is_pf?: boolean;
    department?: string | null;
    category?: string | null;
}

export interface Stats {
    total_subjects: number;
    total_sections: number;
    total_active_students: number;
}

export interface SearchEntity {
    type: "student" | "teacher" | "room";
    name: string;
    id: string;
    subject_count: number;
    subjects: string[]; // Formatted strings like "Teacher - Subject(Section)"
    times: SectionTime[];
}

export interface SearchResultStats {
    keyword: string;
    prefix: string;
    entities: SearchEntity[];
    total_subjects: number;
    total_sections: number;
    total_matched_students: number;
    warning?: string;
}
