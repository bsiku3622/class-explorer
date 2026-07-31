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

/**
 * 분반.
 *
 * ⚠️ `students` 가 다시 들어 있습니다. Trade 가 "이 분반 수강생 중 내 분반을 받을 수
 * 있는 사람"을 찾는 기능이라 명단 없이는 성립하지 않아 되돌렸습니다.
 *
 * 그래서 이 앱이 좁은 지점은 명단 유무가 아니라 **훑는 화면이 없다**는 것입니다 —
 * 검색은 한 번에 한 명이고(`benchApi`), 전교생을 늘어놓는 목록 화면이 없습니다.
 */
export interface Section {
    id: number;
    section: string;
    teacher: string;
    room: string;
    students: StudentInfo[];
    /** 인원수는 줍니다 — 개인을 가리키지 않고 수강신청에 쓸모가 있습니다 */
    student_count: number;
    /**
     * 학번(입학연도)별 인원. `{"25": 24, "24": 1}`
     *
     * 분포만으로는 "누군가 재수강 중"까지만 드러나고 그게 누구인지는 여전히 한 명씩
     * 찾아야 합니다. 이 앱이 그은 선은 **이름이 나가지 않는다**입니다.
     */
    year_counts: Record<string, number>;
    times: SectionTime[];
}

/** `GET /students/search` 한 건 */
export interface StudentCandidate {
    stuId: string;
    name: string;
}

/** `GET /students/{stuId}` — 한 학생의 한 학기 수업 */
export interface StudentClass {
    id: number;
    subject: string;
    subject_id: number;
    is_ec: boolean;
    section: string;
    teacher: string;
    room: string;
    credits: number | null;
    is_pf: boolean;
    department: string | null;
    times: SectionTime[];
}

export interface StudentTimetable {
    student: StudentCandidate;
    term: Term;
    classes: StudentClass[];
}

/** `GET /stats/enrollment` — 값 → 인원수, 값 → 학번 → 인원수 */
export interface Histogram {
    total: Record<string, number>;
    by_year: Record<string, Record<string, number>>;
}

/**
 * 친구 한 명. **단방향**이라 내가 추가하면 끝이고 상대의 수락이 없습니다 —
 * 남의 시간표는 어차피 한 명씩 볼 수 있으니, 이 목록은 북마크에 가깝습니다.
 */
export interface Friend {
    stuId: string;
    name: string;
}

/** `GET /friends/busy` — 언제 수업이 있는지만. **무슨 수업인지는 오지 않습니다** */
export interface FriendBusy extends Friend {
    is_me: boolean;
    /** `"MON-3"` 모양 */
    busy: string[];
}

/** `GET /friends/now` 한 명. `free` 가 null 이면 지금이 수업 시간이 아닙니다 */
export interface FriendNow extends Friend {
    is_me: boolean;
    free: boolean | null;
}

export interface FriendsNowResponse {
    term: Term;
    /** 서버 시계 기준 — 클라이언트 시계는 틀어질 수 있어 서버가 정합니다 */
    now: string;
    /** 주말이면 null */
    day: string | null;
    /** 쉬는시간·점심이면 null */
    period: number | null;
    /** "점심"·"자습" 같은 것. 아니면 null */
    break_name: string | null;
    next_period: { period: number; start: string } | null;
    people: FriendNow[];
}

/** `GET /periods` — 교시 시각표. 화면이 상수를 따로 들지 않도록 서버가 원본을 갖습니다 */
export interface PeriodTime {
    period: number;
    start: string;
    end: string;
    start_minute: number;
    end_minute: number;
}

export interface FriendsBusyResponse {
    term: Term;
    people: FriendBusy[];
}

export interface EnrollmentStats {
    term: Term;
    weekly_periods: Histogram;
    subject_count: Histogram;
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
    /** 과목 단위 학번 분포. 분반 합이 아니라 **중복을 뺀** 값입니다 */
    subject_year_counts: Record<string, number>;
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

/**
 * 검색 결과로 묶이는 대상. **학생은 없습니다** — 학생은 클라이언트가 훑는 게 아니라
 * 서버에 한 명씩 물어보는 흐름(`StudentCandidate`)으로 갈라졌습니다.
 */
export interface SearchEntity {
    type: "teacher" | "room";
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
}
