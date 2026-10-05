import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardList, MapPin } from "lucide-react";
import type { Term } from "../types";
import { fetchExamSchedule, type ExamSchedule } from "../lib/examsApi";
import { examDays, examDateLabel, examConflictIds } from "../lib/examSchedule";
import PageHeader from "../components/molecules/PageHeader";
import RetroCard from "../components/atoms/RetroCard";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import RetroSpinner from "../components/atoms/RetroSpinner";

const ExamsPage: React.FC<{ term: Term | null }> = ({ term }) => {
    const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const year = term?.year;
    const semester = term?.semester;
    useEffect(() => {
        const controller = new AbortController();
        fetchExamSchedule(year && semester ? { year, semester } : null, controller.signal)
            .then((data) => { setSchedule(data); setFailed(false); })
            .catch(() => { if (!controller.signal.aborted) { setSchedule(null); setFailed(true); } });
        return () => controller.abort();
    }, [year, semester, attempt]);

    // 학기 전환 직후 이전 학기 시험을 새 학기 것처럼 보여주지 않습니다.
    const current = schedule?.period && year && semester &&
        (schedule.period.year !== year || schedule.period.semester !== semester) ? null : schedule;
    const period = current?.period;
    const days = current ? examDays(current) : [];
    const separate = current?.exams.filter((exam) => exam.date === null) ?? [];
    const scheduledCount = current?.exams.filter((exam) => exam.date !== null).length ?? 0;
    const conflicts = examConflictIds(current?.exams ?? []);

    return <div className="flex flex-col gap-5 pb-20">
        <PageHeader title="Exams" subtitle={period?.kind === "midterm" ? "Midterm" : "My Schedule"} icon={ClipboardList}
            action={<Link to="/" className="flex items-center gap-1.5 text-xs font-bold underline underline-offset-4"><ArrowLeft size={14} /> 홈으로</Link>}>
            {period && <div className="space-y-1">
                <p className="text-lg font-black">{period.title}</p>
                <p className="text-sm font-bold text-black/60">{examDateLabel(period.start_date)} – {examDateLabel(period.end_date)} · 내 시험 {scheduledCount}개</p>
            </div>}
        </PageHeader>

        {failed ? <RetroCard className="bg-white p-6 space-y-3">
            <p className="text-sm font-bold">시험 시간표를 불러오지 못했습니다.</p>
            <RetroButton size="sm" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>다시 시도</RetroButton>
        </RetroCard> : !current ? <div className="flex justify-center p-12"><RetroSpinner /></div>
            : !period ? <RetroCard className="bg-white p-6 text-sm font-bold">선택한 학기에 등록된 시험 시간표가 없습니다.</RetroCard>
            : <>
                {conflicts.size > 0 && <p className="border-2 border-black bg-white p-3 text-sm font-bold text-red-700">공지에 시험 시간이 겹치는 과목이 있습니다. 두 과목의 일정을 모두 표시했으니 담당 교사의 안내를 확인하세요.</p>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 items-start">
                    {days.map((day) => <RetroCard key={day.date} shadow="sm" className="bg-white overflow-hidden">
                        <div className="border-b-2 border-black bg-black text-white px-4 py-3">
                            <h2 className="text-base font-black">{day.label}</h2>
                            <p className="text-xs font-bold text-white/60">{day.exams.length}개 시험</p>
                        </div>
                        <div className="divide-y-2 divide-black/10">
                            {day.exams.length === 0 ? <p className="p-4 text-sm font-bold text-black/40">예정된 시험 없음</p>
                                : day.exams.map((exam) => <article key={exam.id} className="p-4 space-y-3">
                                    <div>
                                        <p className="text-base font-black tabular-nums">{exam.start}–{exam.end}</p>
                                        <p className="text-xs font-bold text-black/40">{exam.duration}분</p>
                                    </div>
                                    <h3 className="text-[15px] font-black leading-snug break-keep">{exam.subject}</h3>
                                    {conflicts.has(exam.id) && <p className="text-xs font-bold text-red-700">다른 시험과 시간 겹침</p>}
                                    {exam.section && <p className="text-xs font-bold text-black/50">{exam.section}{exam.teacher ? ` · ${exam.teacher}` : ""}</p>}
                                    <div className="flex items-start gap-1.5 text-sm font-black">
                                        <MapPin size={15} className="mt-0.5 shrink-0" />
                                        {exam.room ? <span>{exam.room}</span> : <div><p>분반별 시험실 확인</p><p className="mt-1 whitespace-pre-line text-xs font-bold text-black/60">{exam.room_instruction ?? "시험실은 별도 안내를 확인하세요."}</p></div>}
                                    </div>
                                    {exam.note && <p className="text-xs font-bold text-black/60">{exam.note}</p>}
                                </article>)}
                        </div>
                    </RetroCard>)}
                </div>
                {separate.length > 0 && <RetroCard shadow="sm" className="bg-white p-5 space-y-3">
                    <RetroSubTitle title="Separate Exams" />
                    {separate.map((exam) => <div key={exam.id} className="space-y-1"><p className="text-sm font-black">{exam.subject}</p><p className="text-sm font-bold text-black/60">{exam.note}</p></div>)}
                </RetroCard>}
                <p className="text-xs font-bold text-black/50 leading-relaxed">학교 최종 공지의 응시 명단 기준입니다. 시험실은 평소 수업 강의실과 다를 수 있습니다.</p>
            </>}
    </div>;
};

export default ExamsPage;
