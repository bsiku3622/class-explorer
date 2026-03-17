import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import type { SubjectData } from "../types";
import { getKoreanName } from "../lib/utils";
import FilterSection from "../components/FilterSection";
import SearchInput from "../components/atoms/SearchInput";
import PageHeader from "../components/molecules/PageHeader";
import StudentCard from "../components/atoms/StudentCard";

interface StudentsPageProps {
    allClassesData: SubjectData[];
    studentCounts: Record<string, number>;
    lastUpdated: number | null;
    fetchInitialData: (force?: boolean) => void;
    handleSearch: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
}

const StudentsPage: React.FC<StudentsPageProps> = ({
    allClassesData,
    studentCounts,
    lastUpdated,
    fetchInitialData,
    handleSearch,
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [selectedYears, setSelectedYears] = useState<string[]>(() => Object.keys(studentCounts));
    const [searchInput, setSearchInput] = useState(() =>
        new URLSearchParams(location.search).get("q") || ""
    );

    useEffect(() => {
        const q = new URLSearchParams(location.search).get("q") || "";
        setSearchInput(q);
    }, [location.search]);

    useEffect(() => {
        const years = Object.keys(studentCounts);
        if (years.length > 0 && selectedYears.length === 0) setSelectedYears(years);
    }, [studentCounts]);

    const handleSearchInput = (value: string) => {
        setSearchInput(value);
        const params = new URLSearchParams();
        if (value) params.set("q", value);
        navigate(params.toString() ? `/students?${params}` : "/students", { replace: true });
    };

    const allStudents = useMemo(() => {
        const map = new Map<string, { stuId: string; name: string; subjects: string[]; periodCount: number }>();
        const periodSets: Record<string, Set<string>> = {};

        allClassesData.forEach((sub) => {
            sub.sections.forEach((sec) => {
                sec.students.forEach((stu) => {
                    if (!map.has(stu.stuId)) {
                        map.set(stu.stuId, { stuId: stu.stuId, name: stu.name, subjects: [], periodCount: 0 });
                    }
                    const entry = map.get(stu.stuId)!;
                    const subjectName = getKoreanName(sub.subject);
                    if (!entry.subjects.includes(subjectName)) entry.subjects.push(subjectName);

                    if (!periodSets[stu.stuId]) periodSets[stu.stuId] = new Set();
                    (sec.times || []).forEach((t) =>
                        periodSets[stu.stuId].add(`${t.day}-${t.period}`)
                    );
                });
            });
        });

        map.forEach((student) => {
            student.periodCount = periodSets[student.stuId]?.size || 0;
        });

        return Array.from(map.values()).sort((a, b) => a.stuId.localeCompare(b.stuId));
    }, [allClassesData]);

    const filtered = useMemo(() => {
        const periodsMatch = searchInput.match(/^periods:(\d+)$/i);
        const subcountMatch = searchInput.match(/^subcount:(\d+)$/i);

        return allStudents.filter((s) => {
            const year = s.stuId.split("-")[0];
            if (selectedYears.length > 0 && !selectedYears.includes(year)) return false;
            if (periodsMatch) return s.periodCount === Number(periodsMatch[1]);
            if (subcountMatch) return s.subjects.length === Number(subcountMatch[1]);
            if (searchInput) {
                const q = searchInput.toLowerCase();
                return s.name.toLowerCase().includes(q) || s.stuId.toLowerCase().includes(q);
            }
            return true;
        });
    }, [allStudents, selectedYears, searchInput]);

    return (
        <div className="flex flex-col gap-8 pb-20">
            <PageHeader
                title="Students"
                subtitle={`${allStudents.length} Students`}
                icon={GraduationCap}
            />

            <SearchInput
                value={searchInput}
                onChange={handleSearchInput}
                placeholder="Search by name or student ID..."
            />

            <FilterSection
                studentCounts={studentCounts}
                selectedYears={selectedYears}
                setSelectedYears={setSelectedYears}
                lastUpdated={lastUpdated}
                onRefresh={() => fetchInitialData(true)}
                className="mb-2"
            />

            <p className="text-xs font-bold text-black/30 -mb-4">
                {filtered.length}명 표시 중
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((student) => (
                    <StudentCard
                        key={student.stuId}
                        stuId={student.stuId}
                        name={student.name}
                        subjects={student.subjects}
                        onClick={() => handleSearch(student.stuId)}
                    />
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="flex items-center justify-center py-24">
                    <p className="text-sm font-black text-black/20 uppercase tracking-widest">
                        No Students Found
                    </p>
                </div>
            )}
        </div>
    );
};

export default StudentsPage;
