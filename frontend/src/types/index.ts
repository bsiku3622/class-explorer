export interface StudentInfo {
    stuId: string;
    name: string;
}

export interface Section {
    id: number;
    section: string;
    teacher: string;
    room: string;
    students: StudentInfo[];
    student_count: number;
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
    type: "student" | "teacher";
    name: string;
    id: string;
    subject_count: number;
    subjects: string[];
}

export interface SearchResultStats {
    keyword: string;
    prefix: string;
    entities: SearchEntity[];
    total_subjects: number;
    total_sections: number;
    warning?: string;
}
