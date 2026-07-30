export interface Term {
    year: number;
    semester: number;
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
