/**
 * 이 학기에 듣는 **과목 목록** — 홈의 맨 아래.
 *
 * 위의 격자(`WeekTimetable`)가 "언제" 를 묻는 물건이라면 여기는 **"무엇을"** 입니다.
 *
 * ⚠️ **화면을 새로 만들지 않았습니다.** 검색에서 자기 이름을 찾았을 때 나오는 그
 * 아코디언(`SubjectAccordionItem`)을 **그대로** 씁니다 — 같은 것을 두 벌 만들면 한쪽만
 * 고쳐 놓고 잊습니다. 그래서 이 파일이 하는 일은 딱 하나, **내가 듣는 분반만 남긴
 * `SubjectData` 를 만들어 넘기는 것**입니다.
 *
 * 검색 화면과 같은 조건으로 넘깁니다.
 *
 * | prop | 값 | 왜 |
 * |---|---|---|
 * | `searchMode` | `"student"` | 학생 한 명을 본 결과라는 뜻 |
 * | `isSingleStudentSearch` | `true` | 머리의 칩이 `SECTION 5` 로 바뀝니다 |
 * | `searchTerm` | 내 학번 | 명단에서 **내 배지만** 살아납니다 |
 *
 * ⚠️ `searchTerm` 을 비우면 안 됩니다 — `hasStudentInSearch` 가 켜진 채로 맞는 사람이
 * 하나도 없어서 **명단 전체가 회색**이 됩니다.
 */

import React, { useMemo, useState } from "react";
import type { SubjectData } from "../../types";
import type { TodayClass } from "../../lib/friendsApi";
import { DAYS_ORDER } from "../../lib/utils";
import RetroSubTitle from "../atoms/RetroSubTitle";
import { BookMarked } from "lucide-react";
import SubjectAccordionItem from "../SubjectAccordionItem";

interface MySubjectsProps {
    /** 주간 시간표. **계획을 보는 중이면 계획의 과목이 옵니다** */
    week: Record<string, TodayClass[]>;
    allClassesData: SubjectData[];
    myStuId: string | null;
    /** 아래는 전부 `SubjectAccordionItem` 이 요구하는 것들 (`App.tsx` 가 들고 있습니다) */
    studentSubjectMap: Record<string, string[]>;
    teacherSubjectMap: Record<string, Record<string, string[]>>;
    selectedYears: string[];
    isModifierPressed: boolean;
    handleSearchToggle: (value: string, isTeacher?: boolean, isRoom?: boolean) => void;
}

const MySubjects: React.FC<MySubjectsProps> = ({
    week,
    allClassesData,
    myStuId,
    studentSubjectMap,
    teacherSubjectMap,
    selectedYears,
    isModifierPressed,
    handleSearchToggle,
}) => {
    const [open, setOpen] = useState<string[]>([]);

    /**
     * 내가 듣는 분반만 남긴 과목들.
     *
     * 시간표(`week`)가 기준이라 **계획을 보는 중이면 계획의 과목**이 그대로 따라옵니다 —
     * 여기서 트레이드를 따로 알 필요가 없습니다. 학점·명단 같은 나머지 정보는
     * `allClassesData` 에서 찾아 붙입니다.
     */
    const subjects = useMemo(() => {
        const mine = new Map<string, Set<string>>();
        DAYS_ORDER.forEach((day) => {
            (week[day] ?? []).forEach((klass) => {
                const sections = mine.get(klass.subject) ?? new Set<string>();
                sections.add(klass.section);
                mine.set(klass.subject, sections);
            });
        });

        return allClassesData
            .filter((subject) => mine.has(subject.subject))
            .map((subject) => {
                const wanted = mine.get(subject.subject)!;
                return {
                    ...subject,
                    sections: subject.sections.filter((s) => wanted.has(s.section)),
                };
            })
            .filter((subject) => subject.sections.length > 0)
            .sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
    }, [week, allClassesData]);

    if (subjects.length === 0) return null;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
                <RetroSubTitle title="Subjects" icon={BookMarked} iconSize={15} />
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-black/35">
                    {subjects.length}과목
                </span>
            </div>

            <div>
                {subjects.map((subject) => (
                    <SubjectAccordionItem
                        key={subject.subject}
                        subject={subject}
                        // 내 배지만 살아나게 하는 값입니다 (파일 머리의 ⚠️ 참고)
                        searchTerm={myStuId ?? ""}
                        handleSearchToggle={handleSearchToggle}
                        studentSubjectMap={studentSubjectMap}
                        teacherSubjectMap={teacherSubjectMap}
                        isModifierPressed={isModifierPressed}
                        hasStudentInSearch={Boolean(myStuId)}
                        selectedYears={selectedYears}
                        searchMode="student"
                        isOpen={open.includes(subject.subject)}
                        onToggle={() =>
                            setOpen((prev) =>
                                prev.includes(subject.subject)
                                    ? prev.filter((s) => s !== subject.subject)
                                    : [...prev, subject.subject],
                            )
                        }
                        isSingleStudentSearch
                    />
                ))}
            </div>
        </div>
    );
};

export default MySubjects;
