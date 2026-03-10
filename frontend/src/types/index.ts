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
    subject: string;
    subject_student_count: number;
    section_count: number;
    sections: Section[];
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
