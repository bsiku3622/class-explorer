import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    Navbar,
    NavbarBrand,
    NavbarContent,
    Input,
    Card,
    CardBody,
    Chip,
    Divider,
    Spinner,
    Tooltip,
} from "@heroui/react";
import {
    Search,
    User,
    MapPin,
    Users,
    BookOpen,
    Filter,
    ChevronDown,
    HelpCircle,
    X,
} from "lucide-react";
import { getStudentColor } from "./lib/utils";

interface StudentInfo {
    stuId: string;
    name: string;
}

interface Section {
    id: number;
    section: string;
    teacher: string;
    room: string;
    students: StudentInfo[];
    student_count: number;
}

interface SubjectData {
    subject: string;
    subject_student_count: number;
    section_count: number;
    sections: Section[];
}

interface Stats {
    total_subjects: number;
    total_sections: number;
    total_active_students: number;
}

interface SearchEntity {
    type: "student" | "teacher";
    name: string;
    id: string;
    subject_count: number;
    subjects: string[];
}

interface SearchResultStats {
    keyword: string;
    prefix: string;
    entities: SearchEntity[];
    total_subjects: number;
    total_sections: number;
}

// 툴팁용 애니메이션 설정 (위치 튐 방지 및 순수 Opacity 전환)
const tooltipMotionProps = {
    initial: { opacity: 0, x: 0, y: 0, scale: 1 },
    variants: {
        enter: {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            transition: {
                opacity: { duration: 0.1 },
            },
        },
        exit: {
            opacity: 0,
            x: 0,
            y: 0,
            scale: 1,
            transition: {
                opacity: { duration: 0.1 },
            },
        },
    },
};

// 개별 분반 정보를 렌더링하는 컴포넌트
const SectionCard: React.FC<{
    section: Section;
    searchTerm: string;
    handleSearchToggle: (v: string, isT?: boolean) => void;
    studentSubjectMap: Record<string, string[]>;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    isModifierPressed: boolean;
    hasStudentInSearch: boolean;
    selectedYears: string[];
}> = ({
    section,
    searchTerm,
    handleSearchToggle,
    studentSubjectMap,
    teacherSubjectMap,
    isModifierPressed,
    hasStudentInSearch,
    selectedYears,
}) => {
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

    // 접두사 제거 및 모든 키워드 추출 (하이라이트용 평면 리스트)
    const effectiveSearchTerms = React.useMemo(() => {
        if (!searchTerm) return [];
        const clean = searchTerm.trim();
        let query = clean;
        if (clean.includes(":")) {
            const parts = clean.split(":", 2);
            query = parts[1].trim();
        }
        // +, & 연산자 모두 분리하여 순수 단어들만 추출
        return query
            .split(/[+&]/)
            .map((k) => k.trim().toLowerCase())
            .filter((k) => k !== "");
    }, [searchTerm]);

    const isTeacherSearching = React.useMemo(() => {
        return effectiveSearchTerms.some((term) =>
            section.teacher.toLowerCase().includes(term),
        );
    }, [effectiveSearchTerms, section.teacher]);

    // 선생님 담당 과목 정보 포맷팅
    const teacherInfo = teacherSubjectMap[section.teacher] || {};
    const teacherClasses = Object.entries(teacherInfo).map(
        ([subject, sections]) => {
            const cleanSubject = subject.split("(")[0];
            const sectionNums = sections
                .map((s) => s.replace(/[^0-9]/g, ""))
                .sort()
                .join(",");
            return `${cleanSubject}(${sectionNums})`;
        },
    );

    // 선택된 학번 필터 적용
    const filteredStudents = section.students.filter((s) =>
        selectedYears.includes(s.stuId.split("-")[0]),
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-4 space-y-4">
                <h3 className="text-lg font-black bg-retro-accent1 border-2 border-black px-4 py-1.5 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] inline-block uppercase italic">
                    {section.section}
                </h3>
                <div className="space-y-3 pt-1">
                    <Tooltip
                        isOpen={
                            isModifierPressed &&
                            hoveredItemId === `teacher-${section.id}`
                        }
                        placement="top"
                        offset={15}
                        delay={0}
                        closeDelay={0}
                        motionProps={tooltipMotionProps}
                        classNames={{
                            base: "!transition-none",
                            content:
                                "p-0 rounded-none border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden !transition-none",
                        }}
                        content={
                            <div className="flex divide-x-2 divide-black min-w-75">
                                <div className="p-4 bg-retro-secondary/10 flex flex-col justify-center min-w-25">
                                    <p className="text-[10px] font-black text-black/40 uppercase tracking-tighter mb-1">
                                        Teacher
                                    </p>
                                    <p className="text-xl font-black text-retro-secondary italic tracking-tight">
                                        {section.teacher}
                                    </p>
                                </div>
                                <div className="p-4 flex-1 bg-white">
                                    <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <BookOpen size={12} /> Assigned Classes
                                    </p>
                                    <div className="space-y-1.5">
                                        {teacherClasses.map((cls, i) => (
                                            <div
                                                key={i}
                                                className="text-[10px] font-bold text-black border-l-2 border-retro-secondary pl-1.5"
                                            >
                                                {cls}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        }
                    >
                        <div
                            className={`flex items-center gap-3 text-sm font-black italic cursor-pointer transition-all px-2 py-1 -ml-2 border-2 ${
                                isTeacherSearching
                                    ? "bg-retro-secondary text-white border-black shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] scale-105"
                                    : "hover:text-retro-secondary border-transparent"
                            }`}
                            onMouseEnter={() =>
                                setHoveredItemId(`teacher-${section.id}`)
                            }
                            onMouseLeave={() => setHoveredItemId(null)}
                            onClick={() =>
                                handleSearchToggle(section.teacher, true)
                            }
                        >
                            <User
                                size={20}
                                className={
                                    isTeacherSearching
                                        ? "text-white"
                                        : "text-retro-secondary"
                                }
                            />
                            <span>{section.teacher}</span>
                        </div>
                    </Tooltip>

                    <div className="flex items-center gap-3 text-sm font-black italic text-black/70">
                        <MapPin size={20} className="text-retro-primary" />
                        <span>{section.room}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-black italic text-black/70">
                        <Users size={20} className="text-retro-accent4" />
                        <span>{section.student_count} Students</span>
                    </div>
                </div>
            </div>
            <div className="md:col-span-8">
                <div className="flex flex-wrap gap-2.5">
                    {filteredStudents.map((student) => {
                        const color = getStudentColor(student.stuId);
                        const isMatch = effectiveSearchTerms.some(
                            (term) =>
                                student.stuId.toLowerCase().includes(term) ||
                                student.name.toLowerCase().includes(term),
                        );

                        // 검색 결과에 학생이 포함된 경우에만 하이라이트(그레이스케일) 효과 적용

                        const shouldGrayOut = hasStudentInSearch && !isMatch;

                        const mySubjects =
                            studentSubjectMap[student.stuId] || [];

                        return (
                            <Tooltip
                                key={student.stuId}
                                isOpen={
                                    isModifierPressed &&
                                    hoveredItemId === student.stuId
                                }
                                placement="top"
                                offset={15}
                                delay={0}
                                closeDelay={0}
                                motionProps={tooltipMotionProps}
                                classNames={{
                                    base: "!transition-none",
                                    content:
                                        "p-0 rounded-none border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden !transition-none",
                                }}
                                content={
                                    <div className="flex divide-x-2 divide-black min-w-[320px] max-w-112.5">
                                        {/* Left 'Page': Info */}
                                        <div
                                            className="p-4 flex flex-col justify-center min-w-30"
                                            style={{
                                                backgroundColor: `${color}26`,
                                            }}
                                        >
                                            <p className="text-[10px] font-black text-black/40 uppercase tracking-tighter mb-1">
                                                Student ID
                                            </p>
                                            <p className="text-xs font-black text-black leading-none mb-3">
                                                {student.stuId}
                                            </p>
                                            <p className="text-[10px] font-black text-black/40 uppercase tracking-tighter mb-1">
                                                Name
                                            </p>
                                            <p
                                                className="text-xl font-black italic tracking-tight"
                                                style={{ color: color }}
                                            >
                                                {student.name}
                                            </p>
                                        </div>
                                        {/* Right 'Page': Subjects */}
                                        <div className="p-4 flex-1 bg-white">
                                            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <BookOpen size={12} /> Enrolled
                                                Classes
                                            </p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                {mySubjects.map((sub, i) => (
                                                    <div
                                                        key={i}
                                                        className="text-[10px] font-bold text-black border-l-2 pl-1.5 truncate"
                                                        style={{
                                                            borderColor: color,
                                                        }}
                                                    >
                                                        {sub.split("(")[0]}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                }
                            >
                                <div
                                    className={`student-badge cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 ${
                                        shouldGrayOut
                                            ? "grayscale opacity-50 scale-95 border-black/20 shadow-none"
                                            : ""
                                    }`}
                                    style={{
                                        borderColor: shouldGrayOut
                                            ? "#00000020"
                                            : color,
                                        backgroundColor: shouldGrayOut
                                            ? "transparent"
                                            : `${color}20`,
                                        color: shouldGrayOut
                                            ? "rgba(0,0,0,0.6)"
                                            : color,
                                    }}
                                    onMouseEnter={() =>
                                        setHoveredItemId(student.stuId)
                                    }
                                    onMouseLeave={() => setHoveredItemId(null)}
                                    onClick={() =>
                                        handleSearchToggle(student.stuId)
                                    }
                                >
                                    {student.stuId.split("-")[0]} {student.name}
                                </div>
                            </Tooltip>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// 커스텀 아코디언 아이템 컴포넌트
const SubjectAccordionItem: React.FC<{
    subject: SubjectData;
    searchTerm: string;
    handleSearchToggle: (v: string, isT?: boolean) => void;
    studentSubjectMap: Record<string, string[]>;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    isModifierPressed: boolean;
    hasStudentInSearch: boolean;
    selectedYears: string[];
    isOpen: boolean;
    onToggle: () => void;
    isSingleStudentSearch?: boolean;
}> = ({
    subject,
    searchTerm,
    handleSearchToggle,
    studentSubjectMap,
    teacherSubjectMap,
    isModifierPressed,
    hasStudentInSearch,
    selectedYears,
    isOpen,
    onToggle,
    isSingleStudentSearch,
}) => {
    const [hoveredTeacher, setHoveredTeacher] = useState<string | null>(null);

    // 접두사 제거 및 모든 키워드 추출 (하이라이트용 평면 리스트)
    const effectiveSearchTerms = React.useMemo(() => {
        if (!searchTerm) return [];
        const clean = searchTerm.trim();
        let query = clean;
        if (clean.includes(":")) {
            const parts = clean.split(":", 2);
            query = parts[1].trim();
        }
        // +, & 연산자 모두 분리하여 순수 단어들만 추출
        return query
            .split(/[+&]/)
            .map((k) => k.trim().toLowerCase())
            .filter((k) => k !== "");
    }, [searchTerm]);

    // 해당 과목의 선생님별 분반 요약 생성
    const teacherSummary = React.useMemo(() => {
        const summary: Record<string, string[]> = {};
        subject.sections.forEach((s) => {
            if (!summary[s.teacher]) summary[s.teacher] = [];
            const num = s.section.replace(/[^0-9]/g, "");
            if (num && !summary[s.teacher].includes(num))
                summary[s.teacher].push(num);
        });
        return summary;
    }, [subject.sections]);

    // 필터링된 실제 학생 수 계산
    const visibleStudentCount = React.useMemo(() => {
        const uniqueIds = new Set<string>();
        subject.sections.forEach((section) => {
            section.students.forEach((student) => {
                if (selectedYears.includes(student.stuId.split("-")[0])) {
                    uniqueIds.add(student.stuId);
                }
            });
        });
        return uniqueIds.size;
    }, [subject.sections, selectedYears]);

    // 분반 표시 텍스트 및 색상 결정
    const sectionDisplayText = isSingleStudentSearch
        ? `SECTION ${subject.sections.map((s) => s.section.replace(/[^0-9]/g, "")).join(",")}`
        : `${subject.section_count} SECTIONS`;

    return (
        <div className="border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] bg-white overflow-hidden rounded-none w-full mb-6 last:mb-0">
            {/* Trigger */}
            <button
                onClick={onToggle}
                className="w-full px-6 py-6 flex items-center justify-between hover:bg-retro-accent1/10 focus:outline-none group transition-colors"
            >
                <div className="flex flex-row items-center justify-between gap-4 flex-1 mr-6 text-left overflow-hidden">
                    <span className="text-xl font-black text-black tracking-tight uppercase italic truncate flex-1">
                        {subject.subject}
                    </span>
                    <div className="flex gap-3 shrink-0">
                        <Chip
                            size="lg"
                            className={`${isSingleStudentSearch ? "bg-retro-accent1" : "bg-retro-accent2"} border-2 border-black text-xs font-black rounded-none shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] px-3 h-auto py-1.5 uppercase`}
                        >
                            {sectionDisplayText}
                        </Chip>
                        <Chip
                            size="lg"
                            className="bg-retro-accent3 border-2 border-black text-xs font-black rounded-none shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] px-3 h-auto py-1.5"
                        >
                            {visibleStudentCount} STUDENTS
                        </Chip>
                    </div>
                </div>
                <ChevronDown
                    size={20}
                    style={{ transition: "none" }}
                    className={`text-black shrink-0 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {/* Instant Content */}
            {isOpen && (
                <div className="overflow-hidden border-t-2 border-black bg-retro-bg/10">
                    <div className="px-6 pb-12 pt-10 space-y-12">
                        {/* Teacher Summary Section */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white/50 border-2 border-black p-4 mb-12 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                            <span className="text-sm font-black uppercase italic text-black/50 flex items-center gap-2">
                                <Users size={16} /> Teachers :
                            </span>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {Object.entries(teacherSummary).map(
                                    ([name, nums]) => {
                                        const isSearching =
                                            effectiveSearchTerms.some((term) =>
                                                name
                                                    .toLowerCase()
                                                    .includes(term),
                                            );
                                        const teacherInfo =
                                            teacherSubjectMap[name] || {};
                                        const teacherClasses = Object.entries(
                                            teacherInfo,
                                        ).map(([sub, sections]) => {
                                            const cleanSub = sub.split("(")[0];
                                            const secStr = sections
                                                .map((s) =>
                                                    s.replace(/[^0-9]/g, ""),
                                                )
                                                .sort()
                                                .join(",");
                                            return `${cleanSub}(${secStr})`;
                                        });

                                        return (
                                            <Tooltip
                                                key={name}
                                                isOpen={
                                                    isModifierPressed &&
                                                    hoveredTeacher === name
                                                }
                                                placement="top"
                                                motionProps={tooltipMotionProps}
                                                classNames={{
                                                    base: "!transition-none",
                                                    content:
                                                        "p-0 rounded-none border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] overflow-hidden !transition-none",
                                                }}
                                                content={
                                                    <div className="flex divide-x-2 divide-black min-w-75">
                                                        <div className="p-4 bg-retro-secondary/10 flex flex-col justify-center min-w-25">
                                                            <p className="text-[10px] font-black text-black/40 uppercase tracking-tighter mb-1">
                                                                Teacher
                                                            </p>
                                                            <p className="text-xl font-black text-retro-secondary italic tracking-tight">
                                                                {name}
                                                            </p>
                                                        </div>
                                                        <div className="p-4 flex-1 bg-white">
                                                            <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                <BookOpen
                                                                    size={12}
                                                                />{" "}
                                                                Assigned Classes
                                                            </p>
                                                            <div className="space-y-1.5">
                                                                {teacherClasses.map(
                                                                    (
                                                                        cls,
                                                                        i,
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                i
                                                                            }
                                                                            className="text-[10px] font-bold text-black border-l-2 border-retro-secondary pl-1.5"
                                                                        >
                                                                            {
                                                                                cls
                                                                            }
                                                                        </div>
                                                                    ),
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                }
                                            >
                                                <button
                                                    className={`text-sm font-black transition-colors hover:text-retro-secondary cursor-pointer ${isSearching ? "text-retro-secondary underline decoration-2 underline-offset-4" : "text-black"}`}
                                                    onMouseEnter={() =>
                                                        setHoveredTeacher(name)
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredTeacher(null)
                                                    }
                                                    onClick={() =>
                                                        handleSearchToggle(
                                                            name,
                                                            true,
                                                        )
                                                    }
                                                >
                                                    {name}(
                                                    {nums.sort().join(",")})
                                                </button>
                                            </Tooltip>
                                        );
                                    },
                                )}
                            </div>
                        </div>

                        {subject.sections.map(
                            (section: Section, idx: number) => (
                                <React.Fragment key={section.id}>
                                    {idx > 0 && (
                                        <Divider className="mb-10 h-1 bg-black opacity-100" />
                                    )}
                                    <SectionCard
                                        section={section}
                                        searchTerm={searchTerm}
                                        handleSearchToggle={handleSearchToggle}
                                        studentSubjectMap={studentSubjectMap}
                                        teacherSubjectMap={teacherSubjectMap}
                                        isModifierPressed={isModifierPressed}
                                        hasStudentInSearch={hasStudentInSearch}
                                        selectedYears={selectedYears}
                                    />
                                </React.Fragment>
                            ),
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const App: React.FC = () => {
    const [data, setData] = useState<SubjectData[]>([]);
    const [allClassesData, setAllClassesData] = useState<SubjectData[]>([]); // 툴팁용 전체 데이터 보관
    const [stats, setStats] = useState<Stats | null>(null);
    const [studentCounts, setStudentCounts] = useState<Record<string, number>>(
        {},
    );
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [isModifierPressed, setIsModifierPressed] = useState(false);
    const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
    const [searchResult, setSearchResult] = useState<SearchResultStats | null>(
        null,
    );

    // 검색 결과에 학생이 포함되어 있는지 여부 계산
    const hasStudentInSearch = React.useMemo(() => {
        if (!searchResult) return false;
        return searchResult.entities.some((e) => e.type === "student");
    }, [searchResult]);

    // 조합키 상태 추적 (Cmd or Ctrl)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey) setIsModifierPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (!e.metaKey && !e.ctrlKey) setIsModifierPressed(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    // 학생별 수강 과목 맵핑 (검색 결과에 상관없이 전체 데이터 기준)
    const studentSubjectMap = React.useMemo(() => {
        const map: Record<string, string[]> = {};
        allClassesData.forEach((item) => {
            item.sections.forEach((section) => {
                section.students.forEach((student) => {
                    if (!map[student.stuId]) map[student.stuId] = [];
                    if (!map[student.stuId].includes(item.subject))
                        map[student.stuId].push(item.subject);
                });
            });
        });
        return map;
    }, [allClassesData]);

    // 선생님별 담당 과목/분반 맵핑 (검색 결과에 상관없이 전체 데이터 기준)
    const teacherSubjectMap = React.useMemo(() => {
        const map: Record<string, Record<string, string[]>> = {};
        allClassesData.forEach((item) => {
            item.sections.forEach((section) => {
                if (!map[section.teacher]) map[section.teacher] = {};
                if (!map[section.teacher][item.subject])
                    map[section.teacher][item.subject] = [];
                if (
                    !map[section.teacher][item.subject].includes(
                        section.section,
                    )
                ) {
                    map[section.teacher][item.subject].push(section.section);
                }
            });
        });
        return map;
    }, [allClassesData]);

    useEffect(() => {
        fetchStudentCounts();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, selectedYears]);

    const fetchStudentCounts = async () => {
        try {
            // 1. 학번별 학생 수 가져오기
            const countResponse = await axios.get("/api/students_num_info");
            const years = Object.keys(countResponse.data);
            setStudentCounts(countResponse.data);
            setSelectedYears(years);

            // 2. 툴팁용 전체 수업 데이터 미리 로드 (필터링되지 않은 원본)
            const allDataResponse = await axios.get("/api/classes_info");
            setAllClassesData(allDataResponse.data.data);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        }
    };

    const fetchData = async () => {
        if (selectedYears.length === 0) {
            setData([]);
            setStats(null);
            setSearchResult(null);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            if (searchTerm) {
                let cleanKeyword = searchTerm.trim();
                let effectiveQuery = cleanKeyword;
                let apiUrl = `/api/search/${cleanKeyword}`;

                // 접두사 파싱 (teacher:만 유지)
                if (cleanKeyword.includes(":")) {
                    const parts = cleanKeyword.split(":", 2);
                    const prefix = parts[0].toLowerCase();
                    const query = parts[1].trim();

                    if (["t", "te", "teacher"].includes(prefix)) {
                        apiUrl = `/api/teacher/${query}`;
                        effectiveQuery = query;
                    } else {
                        apiUrl = `/api/search/${query}`;
                        effectiveQuery = query;
                    }
                }

                const response = await axios.get(apiUrl);

                // 검색 결과 데이터 정제: 논리 연산자(+, &) 지원 빈 아코디언 방지 로직
                const rawData = response.data.data;

                // 논리 구조 파싱: [[A, B], [C]] -> (A & B) + C
                const orGroups = effectiveQuery
                    .split("+")
                    .map((g) =>
                        g
                            .split("&")
                            .map((t) => t.trim())
                            .map((t) => t.toLowerCase())
                            .filter((t) => t !== ""),
                    )
                    .filter((g) => g.length > 0);

                const processedData = rawData
                    .map((subject: SubjectData) => {
                        const filteredSections = subject.sections.filter(
                            (section) => {
                                // 1. 해당 분반에서 선택된 학번의 학생만 추출
                                const visibleStudents = section.students.filter(
                                    (s) =>
                                        selectedYears.includes(
                                            s.stuId.split("-")[0],
                                        ),
                                );

                                // 2. 선택된 학번의 학생이 한 명도 없다면 이 분반은 표시할 이유가 없음
                                if (visibleStudents.length === 0) return false;

                                // 3. 논리 연산 체크: ANY(OR 그룹) of ALL(AND 그룹)
                                const classPool = [
                                    section.teacher.toLowerCase(),
                                    subject.subject.toLowerCase(),
                                    section.section.toLowerCase(),
                                    ...visibleStudents.flatMap((s) => [
                                        s.name.toLowerCase(),
                                        s.stuId.toLowerCase(),
                                    ]),
                                ];

                                return orGroups.some((andGroup) =>
                                    andGroup.every((term) =>
                                        classPool.some((item) =>
                                            item.includes(term),
                                        ),
                                    ),
                                );
                            },
                        );

                        return { ...subject, sections: filteredSections };
                    })
                    .filter(
                        (subject: SubjectData) => subject.sections.length > 0,
                    );

                setData(processedData);

                // 검색 결과 엔티티 처리 (동명이인 등 다중 매칭 대응)
                let entities: SearchEntity[] = response.data.entities || [];
                if (
                    !entities.length &&
                    response.data.prefix === "student" &&
                    response.data.name
                ) {
                    entities = [
                        {
                            type: "student",
                            name: response.data.name,
                            id: response.data.stuId,
                            subject_count: response.data.total_subjects,
                            subjects: response.data.data.map(
                                (d: SubjectData) => d.subject,
                            ),
                        },
                    ];
                } else if (
                    !entities.length &&
                    response.data.prefix === "teacher" &&
                    response.data.data.length > 0
                ) {
                    entities = [
                        {
                            type: "teacher",
                            name: response.data.keyword || effectiveQuery,
                            id: "Teacher",
                            subject_count: response.data.total_subjects,
                            subjects: response.data.data.map(
                                (d: SubjectData) => d.subject,
                            ),
                        },
                    ];
                }

                setSearchResult({
                    keyword: response.data.keyword || effectiveQuery,
                    prefix: response.data.prefix || "",
                    entities: entities.filter(
                        (e: SearchEntity) =>
                            e.type === "teacher" ||
                            selectedYears.includes(e.id.split("-")[0]),
                    ),
                    total_subjects: response.data.total_subjects,
                    total_sections: response.data.total_sections,
                });

                // 검색 결과 로드 완료 후 상단으로 부드럽게 이동
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                const params = { years: selectedYears.join(",") };
                const response = await axios.get("/api/classes_info", {
                    params,
                });
                setData(response.data.data);
                setStats(response.data.total_stats);
                setSearchResult(null);

                // 데이터 업데이트 완료 후 상단으로 부드럽게 이동
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchToggle = (value: string, isTeacher: boolean = false) => {
        const finalValue = isTeacher ? `teacher:${value}` : value;
        setSearchTerm((prev) => (prev === finalValue ? "" : finalValue));
    };

    const handleSearchSelect = (value: string, isTeacher: boolean = false) => {
        const finalValue = isTeacher ? `teacher:${value}` : value;
        setSearchTerm(finalValue);
    };

    const toggleSubject = (subjectName: string) => {
        setExpandedSubjects((prev) =>
            prev.includes(subjectName)
                ? prev.filter((s) => s !== subjectName)
                : [...prev, subjectName],
        );
    };

    return (
        <div className="min-h-screen bg-retro-bg text-retro-fg pb-20 font-sans">
            {/* Navbar */}
            <Navbar
                isBordered={false}
                className="fixed top-0 left-0 right-0 bg-retro-secondary border-b-2 border-black h-20 shadow-[0_4px_0_0_rgba(0,0,0,0.2)] z-1000"
                maxWidth="full"
            >
                <NavbarBrand>
                    <p className="text-2xl font-black italic tracking-tighter text-white uppercase transform -skew-x-6">
                        Class Finder
                    </p>
                </NavbarBrand>
                <NavbarContent className="hidden sm:flex" justify="end">
                    <div className="relative">
                        <Input
                            labelPlacement="outside"
                            classNames={{
                                base: "w-96",
                                input: "text-base font-semibold px-2 pr-10 flex-1 h-full focus:outline-none",
                                inputWrapper:
                                    "h-12 bg-white border-2 border-black rounded-none shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] data-[hover=true]:border-black group-data-[focus=true]:border-black px-4 flex items-center outline-none ring-0 relative",
                                innerWrapper:
                                    "flex flex-row items-center gap-2 w-full h-full",
                            }}
                            placeholder="Search by Something..."
                            startContent={
                                <Search
                                    className="text-black/60 shrink-0"
                                    size={18}
                                />
                            }
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {/* Unified Action Button (X or ?) - Standard Thin Style */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center">
                            {searchTerm ? (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="text-black/40 hover:text-black/70 transition-colors p-1"
                                >
                                    <X size={18} strokeWidth={2} />
                                </button>
                            ) : (
                                <Tooltip
                                    placement="bottom"
                                    content={
                                        <div className="p-3 space-y-3">
                                            <p className="font-black text-sm border-b-2 border-black pb-1 mb-2">
                                                SEARCH GUIDE
                                            </p>
                                            <div className="space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <span className="bg-retro-accent1 px-1 text-[10px] font-black border border-black">
                                                        BASIC
                                                    </span>
                                                    <p className="text-[10px] font-bold leading-tight">
                                                        이름, 학번, 과목명을
                                                        <br />
                                                        자유롭게 입력하세요.
                                                    </p>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="bg-retro-secondary text-white px-1 text-[10px] font-black border border-black">
                                                        TEACHER
                                                    </span>
                                                    <p className="text-[10px] font-bold leading-tight">
                                                        <span className="text-retro-secondary">
                                                            teacher:성함
                                                        </span>{" "}
                                                        입력 시<br />
                                                        강제로 선생님만
                                                        검색합니다.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    }
                                    motionProps={tooltipMotionProps}
                                    classNames={{
                                        content:
                                            "rounded-none border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]",
                                    }}
                                >
                                    <div className="text-black/40 hover:text-black/70 transition-colors cursor-help p-1">
                                        <HelpCircle size={18} strokeWidth={2} />
                                    </div>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </NavbarContent>
            </Navbar>

            <main className="max-w-6xl mx-auto px-6 pt-32">
                {/* Filters */}
                <div className="mb-10 bg-white border-2 border-black p-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-3 mb-6">
                        <Filter size={20} className="text-retro-secondary" />
                        <span className="text-sm font-black uppercase tracking-widest italic text-black/40">
                            Filter by Student Cohort
                        </span>
                        {selectedYears.length <
                            Object.keys(studentCounts).length && (
                            <button
                                onClick={() =>
                                    setSelectedYears(Object.keys(studentCounts))
                                }
                                className="ml-auto text-sm font-black uppercase underline hover:text-retro-primary transition-colors tracking-tight"
                            >
                                Reset All Filters
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-4">
                        {Object.entries(studentCounts).map(([year, count]) => {
                            const isSelected = selectedYears.includes(year);
                            const color = getStudentColor(year);

                            return (
                                <label
                                    key={year}
                                    className={`group relative flex items-center gap-3 px-4 py-2 border-2 cursor-pointer transition-all duration-200 ${
                                        isSelected
                                            ? "border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] translate-x-0.5 translate-y-0.5"
                                            : "border-black/10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 hover:border-black/30"
                                    }`}
                                    style={{
                                        backgroundColor: isSelected
                                            ? `${color}20`
                                            : "transparent",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={isSelected}
                                        onChange={() => {
                                            if (isSelected) {
                                                setSelectedYears(
                                                    selectedYears.filter(
                                                        (y) => y !== year,
                                                    ),
                                                );
                                            } else {
                                                setSelectedYears([
                                                    ...selectedYears,
                                                    year,
                                                ]);
                                            }
                                        }}
                                    />
                                    <div
                                        className="w-4 h-4 border-2 border-black transition-colors"
                                        style={{
                                            backgroundColor: isSelected
                                                ? color
                                                : "transparent",
                                        }}
                                    />
                                    <span
                                        className={`text-sm font-black uppercase ${isSelected ? "text-black" : "text-black/40"}`}
                                    >
                                        {year}{" "}
                                        <span className="ml-1 text-[10px] opacity-60">
                                            ({count})
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* Search Report Box */}
                {searchResult && (
                    <div className="mb-12 space-y-8">
                        <div className="bg-white border-2 border-black p-8 shadow-[8px_8px_0_0_rgba(0,0,0,0.1)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 px-6 py-1.5 bg-black text-white text-xs font-black italic tracking-widest uppercase">
                                Search Status
                            </div>
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                                <div>
                                    <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-2">
                                        Current Keyword
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <span className="text-4xl font-black italic text-black uppercase tracking-tighter">
                                            {searchResult.prefix
                                                ? `${searchResult.prefix}:`
                                                : ""}
                                            {searchResult.keyword}
                                        </span>
                                        <Chip className="bg-black text-white border-2 border-black rounded-none font-black text-xs py-1 px-3">
                                            {searchResult.total_subjects}{" "}
                                            SUBJECTS MATCHED
                                        </Chip>
                                    </div>
                                </div>
                                <div className="flex gap-10 border-t-2 md:border-t-0 md:border-l-2 border-black/10 pt-6 md:pt-0 md:pl-10">
                                    <div>
                                        <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-1">
                                            Identified
                                        </p>
                                        <p className="text-xl font-black text-black">
                                            {searchResult.entities.length}{" "}
                                            People Found
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-black/40 uppercase tracking-widest mb-1">
                                            Match Scope
                                        </p>
                                        <p className="text-xl font-black text-black">
                                            {searchResult.total_sections}{" "}
                                            Sections
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Entity Profiles (Book Style) */}
                        {searchResult.entities.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {searchResult.entities.map((entity, idx) => {
                                    const entityColor =
                                        entity.type === "student"
                                            ? getStudentColor(entity.id)
                                            : "#7828c8";
                                    return (
                                        <div
                                            key={idx}
                                            className="bg-white border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,0.1)] flex divide-x-2 divide-black overflow-hidden cursor-pointer hover:-translate-y-1.5 transition-transform group"
                                            onClick={() =>
                                                handleSearchSelect(
                                                    entity.type === "student"
                                                        ? entity.id
                                                        : entity.name,
                                                    entity.type === "teacher",
                                                )
                                            }
                                        >
                                            {/* Profile Page */}
                                            <div
                                                className="p-6 min-w-40 flex flex-col justify-center relative"
                                                style={{
                                                    backgroundColor: `${entityColor}15`,
                                                }}
                                            >
                                                <span
                                                    className={`absolute top-3 left-3 px-3 py-1 text-[10px] font-black uppercase border border-black/20 ${entity.type === "student" ? "bg-white text-black" : "bg-retro-secondary text-white border-none"}`}
                                                >
                                                    {entity.type}
                                                </span>
                                                <p className="text-[10px] font-black text-black/30 uppercase tracking-tighter mt-4 mb-1">
                                                    {entity.type === "student"
                                                        ? "Student ID"
                                                        : "Position"}
                                                </p>
                                                <p className="text-sm font-black text-black mb-3">
                                                    {entity.id}
                                                </p>
                                                <p
                                                    className="text-3xl font-black italic tracking-tighter group-hover:scale-105 transition-transform"
                                                    style={{
                                                        color: entityColor,
                                                    }}
                                                >
                                                    {entity.name}
                                                </p>
                                            </div>
                                            {/* Classes Page */}
                                            <div className="p-6 flex-1 bg-white overflow-hidden">
                                                <p className="text-[10px] font-black text-black/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <BookOpen size={14} />{" "}
                                                    {entity.type === "student"
                                                        ? "Enrollment"
                                                        : "Teaching"}{" "}
                                                    ({entity.subject_count})
                                                </p>
                                                <div
                                                    className={`grid ${searchResult.entities.length === 1 ? "grid-cols-2 gap-x-6 gap-y-2" : "grid-cols-1 gap-2"}`}
                                                >
                                                    {(searchResult.entities
                                                        .length === 1
                                                        ? entity.subjects
                                                        : entity.subjects.slice(
                                                              0,
                                                              4,
                                                          )
                                                    ).map((sub, i) => (
                                                        <div
                                                            key={i}
                                                            className="text-xs font-bold text-black border-l-2 pl-3 truncate"
                                                            style={{
                                                                borderColor:
                                                                    entityColor,
                                                            }}
                                                        >
                                                            {sub.split("(")[0]}
                                                        </div>
                                                    ))}
                                                    {searchResult.entities
                                                        .length > 1 &&
                                                        entity.subjects.length >
                                                            4 && (
                                                            <p className="text-[10px] font-black text-black/30 pl-3 pt-1">
                                                                +{" "}
                                                                {entity.subjects
                                                                    .length -
                                                                    4}{" "}
                                                                MORE CLASSES
                                                            </p>
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Stats Summary */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        {[
                            {
                                label: "Total Subjects",
                                value: stats.total_subjects,
                                icon: BookOpen,
                                color: "bg-retro-accent1",
                            },
                            {
                                label: "Total Sections",
                                value: stats.total_sections,
                                icon: Users,
                                color: "bg-retro-accent2",
                            },
                            {
                                label: "Active Students",
                                value: stats.total_active_students,
                                icon: User,
                                color: "bg-retro-accent3",
                            },
                        ].map((stat, i) => (
                            <Card
                                key={i}
                                className={`border-2 border-black rounded-none shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] ${stat.color}`}
                            >
                                <CardBody className="flex flex-row items-center gap-5 p-6">
                                    <stat.icon
                                        size={32}
                                        className="text-black"
                                    />
                                    <div>
                                        <p className="text-xs font-black uppercase text-black/60 tracking-wider">
                                            {stat.label}
                                        </p>
                                        <p className="text-3xl font-black text-black">
                                            {stat.value}
                                        </p>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="relative">
                    {/* Persistent Loading Overlay */}
                    {loading && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-start pt-40 gap-4 bg-retro-bg/40 backdrop-blur-[2px]">
                            <Spinner color="primary" size="lg" />
                            <p className="text-lg font-black italic uppercase animate-pulse">
                                Scanning Grid...
                            </p>
                        </div>
                    )}

                    <div
                        className={`space-y-0 transition-opacity duration-300 ${loading ? "opacity-30 pointer-events-none" : "opacity-100"}`}
                    >
                        {data.length > 0
                            ? data.map((subject: SubjectData) => (
                                  <SubjectAccordionItem
                                      key={subject.subject}
                                      subject={subject}
                                      searchTerm={searchTerm}
                                      handleSearchToggle={handleSearchToggle}
                                      studentSubjectMap={studentSubjectMap}
                                      teacherSubjectMap={teacherSubjectMap}
                                      isModifierPressed={isModifierPressed}
                                      hasStudentInSearch={hasStudentInSearch}
                                      selectedYears={selectedYears}
                                      isOpen={expandedSubjects.includes(
                                          subject.subject,
                                      )}
                                      onToggle={() =>
                                          toggleSubject(subject.subject)
                                      }
                                      isSingleStudentSearch={
                                          hasStudentInSearch &&
                                          searchResult?.entities.length === 1
                                      }
                                  />
                              ))
                            : !loading && (
                                  <div className="py-28 flex flex-col items-center justify-center text-black/20">
                                      <p className="text-2xl font-black uppercase italic tracking-widest">
                                          No Data Found
                                      </p>
                                  </div>
                              )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
