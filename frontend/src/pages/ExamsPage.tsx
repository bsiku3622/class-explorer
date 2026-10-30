import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { ArrowLeft, ClipboardList, MapPin } from "lucide-react";
import type { Term } from "../types";
import { fetchExamSchedule, type ExamSchedule } from "../lib/examsApi";
import { examDays, examDateLabel, examConflictIds } from "../lib/examSchedule";
import { Button, Card, Divider, Notice, PageHeader, SectionTitle, Spinner, Surface, Text } from "@studio-baeks/funky-ui";

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
            action={<Button as={RouterLink} to="/" size="xs" variant="ghost" icon={ArrowLeft} uppercase={false}>홈으로</Button>}>
            {period && <div className="space-y-1">
                <Text as="p" variant="subheading">{period.title}</Text>
                <Text as="p" tone="secondary">{examDateLabel(period.start_date)} – {examDateLabel(period.end_date)} · 내 시험 {scheduledCount}개</Text>
            </div>}
        </PageHeader>

        {failed ? <Card padding="0" className="p-6 space-y-3">
            <Text as="p">시험 시간표를 불러오지 못했습니다.</Text>
            <Button size="sm" variant="paper" shadow onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>다시 시도</Button>
        </Card> : !current ? <div className="flex justify-center p-12"><Spinner /></div>
            : !period ? <Card padding="0" className="p-6"><Text as="p">선택한 학기에 등록된 시험 시간표가 없습니다.</Text></Card>
            : <>
                {conflicts.size > 0 && <Notice role="alert">공지에 시험 시간이 겹치는 과목이 있습니다. 두 과목의 일정을 모두 표시했으니 담당 교사의 안내를 확인하세요.</Notice>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 items-start">
                    {days.map((day) => <Card key={day.date} padding="0" className="overflow-hidden">
                        <Surface fill="inverse" className="px-4 py-3">
                            <Text as="h2" variant="subheading" tone="inherit">{day.label}</Text>
                            <Text as="p" variant="caption" tone="inverseMuted">{day.exams.length}개 시험</Text>
                        </Surface>
                        <div>
                            {day.exams.length === 0 ? <Text as="p" tone="muted" className="p-4">예정된 시험 없음</Text>
                                : day.exams.map((exam, index) => <React.Fragment key={exam.id}>
                                    {index > 0 && <Divider />}
                                    <article className="p-4 space-y-3">
                                        <div>
                                            <Text as="p" variant="subheading" numeric>{exam.start}–{exam.end}</Text>
                                            <Text as="p" variant="caption" tone="muted">{exam.duration}분</Text>
                                        </div>
                                        <Text as="h3" variant="subheading" className="break-keep">{exam.subject}</Text>
                                        {conflicts.has(exam.id) && <Text as="p" variant="caption" tone="red">다른 시험과 시간 겹침</Text>}
                                        {exam.section && <Text as="p" variant="caption" tone="muted">{exam.section}{exam.teacher ? ` · ${exam.teacher}` : ""}</Text>}
                                        <Text as="div" weight="black" className="flex items-start gap-1.5">
                                            <MapPin size={15} className="mt-0.5 shrink-0" />
                                            {exam.room ? <span>{exam.room}</span> : <div><p>분반별 시험실 확인</p><Text as="p" variant="caption" tone="secondary" className="mt-1 whitespace-pre-line">{exam.room_instruction ?? "시험실은 별도 안내를 확인하세요."}</Text></div>}
                                        </Text>
                                        {exam.note && <Text as="p" variant="caption" tone="secondary">{exam.note}</Text>}
                                    </article>
                                </React.Fragment>)}
                        </div>
                    </Card>)}
                </div>
                {separate.length > 0 && <Card padding="0" className="p-5 space-y-3">
                    <SectionTitle title="Separate Exams" />
                    {separate.map((exam) => <div key={exam.id} className="space-y-1"><Text as="p" weight="black">{exam.subject}</Text><Text as="p" tone="secondary">{exam.note}</Text></div>)}
                </Card>}
                <Text as="p" variant="caption" tone="muted" leading="relaxed">학교 최종 공지의 응시 명단 기준입니다. 시험실은 평소 수업 강의실과 다를 수 있습니다.</Text>
            </>}
    </div>;
};

export default ExamsPage;
