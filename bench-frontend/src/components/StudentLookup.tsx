/**
 * 사람 찾기 — **두 단계**입니다.
 *
 *   1단계  후보 목록 (이름·학번만)
 *   2단계  하나를 고르면 그 **한 명**의 시간표
 *
 * 한 화면에서 여러 명의 시간표가 한꺼번에 나오지 않게 하려고 단계를 나눴습니다.
 * 이게 이 앱과 class-explorer 를 가르는 지점입니다 — 명단을 얻는 비용이 한 명씩
 * 물어보는 만큼 들게 됩니다.
 */

import React from "react";
import { Spinner } from "@heroui/react";
import { ChevronRight, Search, Users } from "lucide-react";
import type { StudentTimetable } from "../types";
import type { StudentSearchResponse } from "../lib/benchApi";
import { formatSectionTimes, getKoreanName } from "../lib/utils";
import TimetableGrid from "./TimetableGrid";
import RetroSubTitle from "./atoms/RetroSubTitle";

interface StudentLookupProps {
    /** `student:` 뒤에 적은 말. 빈 문자열이면 아직 아무것도 안 쳤다는 뜻 */
    query: string;
    search: StudentSearchResponse | null;
    timetable: StudentTimetable | null;
    loading: boolean;
    error: string | null;
    onSelect: (stuId: string) => void;
    onSearchToggle: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
}

const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="border-2 border-black bg-white px-5 py-8 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
        <p className="text-sm font-bold text-black/50">{children}</p>
    </div>
);

const StudentLookup: React.FC<StudentLookupProps> = ({
    query,
    search,
    timetable,
    loading,
    error,
    onSelect,
    onSearchToggle,
}) => {
    if (error) return <Notice>{error}</Notice>;

    if (loading && !timetable) {
        return (
            <div className="flex flex-col items-center gap-3 py-16">
                <Spinner color="primary" size="lg" />
                <p className="text-sm font-black uppercase tracking-widest text-black/40">
                    Looking up...
                </p>
            </div>
        );
    }

    if (!query) {
        return (
            <Notice>
                찾을 사람의 이름이나 학번을 <b>두 글자 이상</b> 입력해 주세요.
            </Notice>
        );
    }

    if (search?.too_short) {
        return (
            <Notice>
                두 글자 이상 입력해 주세요 — 한 글자로는 너무 많이 걸립니다.
            </Notice>
        );
    }

    // ── 2단계: 고른 한 명의 시간표 ──────────────────────────────────────────
    if (timetable) {
        const total = timetable.classes.length;
        const credits = timetable.classes.reduce(
            (sum, item) => sum + (item.credits ?? 0),
            0,
        );
        const gridTimes = timetable.classes.flatMap((item) =>
            item.times.map((time) => ({
                ...time,
                subject: item.subject,
                section: item.section,
                teacher: item.teacher,
            })),
        );

        return (
            <div className="flex flex-col gap-6">
                <div className="relative overflow-hidden border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] md:p-8">
                    <div className="absolute left-0 top-0 bg-black px-6 py-1.5 text-xs font-black uppercase tracking-widest text-white">
                        Student Profile
                    </div>
                    <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
                        <div>
                            <p className="mb-1 text-sm font-black uppercase tracking-tighter text-black/40">
                                {timetable.student.stuId}
                            </p>
                            <h2 className="text-4xl font-black tracking-tighter md:text-5xl">
                                {timetable.student.name}
                            </h2>
                        </div>
                        <div className="flex gap-3">
                            <div className="border-2 border-black bg-retro-accent3 px-4 py-2">
                                <p className="text-2xl font-black tabular-nums">{total}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-black/50">
                                    Subjects
                                </p>
                            </div>
                            <div className="border-2 border-black bg-retro-accent2 px-4 py-2">
                                <p className="text-2xl font-black tabular-nums">{credits}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-black/50">
                                    Credits
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {gridTimes.length > 0 && (
                    <TimetableGrid times={gridTimes} mode="student" />
                )}

                <div className="border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
                    <RetroSubTitle title="Enrolled" />
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {timetable.classes.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onSearchToggle(item.subject)}
                                className="flex items-center justify-between gap-3 border-2 border-black/10 px-3 py-2 text-left transition-all duration-100 hover:border-black"
                            >
                                <span className="truncate text-sm font-black">
                                    {getKoreanName(item.subject)}
                                    <span className="ml-1.5 text-black/40">
                                        {item.section.replace(/[^0-9]/g, "")}
                                    </span>
                                </span>
                                <span className="shrink-0 text-xs font-bold text-black/40">
                                    {formatSectionTimes(item.times)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── 1단계: 후보 목록 ────────────────────────────────────────────────────
    const candidates = search?.students ?? [];
    if (candidates.length === 0) {
        return <Notice>“{query}” 로 찾은 사람이 없습니다.</Notice>;
    }

    return (
        <div className="border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-2 border-b-2 border-black px-5 py-3">
                <Users size={16} strokeWidth={2.5} className="text-black/40" />
                <RetroSubTitle
                    title={`${candidates.length}${search?.has_more ? "+" : ""} Found`}
                />
            </div>

            {search?.has_more && (
                <div className="flex items-start gap-2 border-b-2 border-black/10 bg-retro-accent1/20 px-5 py-3">
                    <Search size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-black/40" />
                    <p className="text-xs font-bold text-black/60">
                        너무 많이 걸려 20명까지만 보여 줍니다. 더 구체적으로 입력해 주세요.
                    </p>
                </div>
            )}

            <ul>
                {candidates.map((student) => (
                    <li key={student.stuId}>
                        <button
                            onClick={() => onSelect(student.stuId)}
                            className="flex w-full items-center justify-between gap-4 border-b-2 border-black/10 px-5 py-3 text-left transition-colors duration-100 last:border-b-0 hover:bg-retro-accent1/20"
                        >
                            <span className="flex items-center gap-3">
                                <span className="text-xs font-black tabular-nums text-black/40">
                                    {student.stuId}
                                </span>
                                <span className="text-base font-black">{student.name}</span>
                            </span>
                            <ChevronRight size={16} strokeWidth={2.5} className="text-black/30" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default StudentLookup;
