import React, { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import SearchInput from "../components/atoms/SearchInput";
import type { SubjectData } from "../types";
import { getKoreanName } from "../lib/utils";
import PageHeader from "../components/molecules/PageHeader";
import TeacherCard from "../components/atoms/TeacherCard";

interface TeachersPageProps {
    allClassesData: SubjectData[];
    handleSearch: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
}

interface TeacherInfo {
    name: string;
    sections: number;
    periods: number;
    subjects: string[];
}

const TeachersPage: React.FC<TeachersPageProps> = ({ allClassesData, handleSearch }) => {
    const [searchInput, setSearchInput] = useState("");

    const allTeachers = useMemo(() => {
        const map = new Map<string, TeacherInfo>();
        allClassesData.forEach((sub) => {
            sub.sections.forEach((sec) => {
                if (!sec.teacher || sec.teacher === "배정중") return;
                if (!map.has(sec.teacher)) {
                    map.set(sec.teacher, { name: sec.teacher, sections: 0, periods: 0, subjects: [] });
                }
                const entry = map.get(sec.teacher)!;
                entry.sections += 1;
                entry.periods += (sec.times || []).length;
                const subjectName = getKoreanName(sub.subject);
                if (!entry.subjects.includes(subjectName)) entry.subjects.push(subjectName);
            });
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }, [allClassesData]);

    const filtered = useMemo(() => {
        if (!searchInput) return allTeachers;
        const q = searchInput.toLowerCase();
        return allTeachers.filter((t) => t.name.toLowerCase().includes(q));
    }, [allTeachers, searchInput]);

    return (
        <div className="flex flex-col gap-8 pb-20">
            <PageHeader
                title="Teachers"
                subtitle={`${allTeachers.length} Teachers`}
                icon={BookOpen}
            />

            {/* Search */}
            <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search by teacher name..."
            />
            <p className="text-xs font-bold text-black/30 -mb-4">
                {filtered.length}명 표시 중
            </p>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((teacher) => (
                    <TeacherCard
                        key={teacher.name}
                        name={teacher.name}
                        subjects={teacher.subjects}
                        onClick={() => handleSearch(teacher.name, true)}
                    />
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="flex items-center justify-center py-24">
                    <p className="text-sm font-black text-black/20 uppercase tracking-widest">
                        No Teachers Found
                    </p>
                </div>
            )}
        </div>
    );
};

export default TeachersPage;
