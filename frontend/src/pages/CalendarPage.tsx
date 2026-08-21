import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Plus,
    Trash2,
} from "lucide-react";
import api from "../lib/api";
import { authHeader } from "../lib/session";
import type { CalendarEvent, EventRequest, Role } from "../types";
import { hasRole } from "../lib/utils";
import {
    CATEGORY_LABEL,
    CATEGORY_STYLE,
    MONTH_LABEL,
    addDays,
    fromKey,
    gradeLabel,
    groupByDate,
    monthGrid,
    timeLabel,
    toKey,
    weekMarkers,
    weekOf,
} from "../lib/calendar";
import PageHeader from "../components/molecules/PageHeader";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import CalendarGrid from "../components/CalendarGrid";
import RequestSidebar from "../components/RequestSidebar";
import EventFormModal, {
    type EventDraft,
    type FormPurpose,
} from "../components/EventFormModal";

interface CalendarPageProps {
    role: Role;
    /** 로그인한 계정의 학번. 학년 필터의 기본값을 여기서 얻습니다 */
    stuId: string | null;
}

/** `25-059` → 2026학년도 기준 학년. 학번 앞 두 자리가 입학 연도입니다 */
const gradeOf = (stuId: string | null, year: number): number | null => {
    if (!stuId) return null;
    const admitted = Number(stuId.slice(0, 2));
    if (!Number.isFinite(admitted)) return null;
    const grade = year - (2000 + admitted) + 1;
    return grade >= 1 && grade <= 3 ? grade : null;
};

/**
 * 학사일정 달력.
 *
 * 학교 공용 일정과 내 개인 일정을 한 화면에 겹쳐 봅니다. 개인 일정은 나만 보이고,
 * 공용 일정을 넣고 싶으면 매니저에게 제안합니다.
 */
const CalendarPage: React.FC<CalendarPageProps> = ({ role, stuId }) => {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [requests, setRequests] = useState<EventRequest[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [onlyMyGrade, setOnlyMyGrade] = useState(false);
    const [form, setForm] = useState<FormPurpose | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [decidingId, setDecidingId] = useState<number | null>(null);
    const [error, setError] = useState("");

    const isManager = hasRole(role, "manager");
    const myGrade = gradeOf(stuId, year);

    // 격자가 앞뒤 달을 물고 있으므로 그 범위까지 받아 옵니다
    const range = useMemo(() => {
        const days = monthGrid(year, month);
        return { start: toKey(days[0]), end: toKey(days[days.length - 1]) };
    }, [year, month]);

    const fetchEvents = useCallback(async () => {
        try {
            const res = await api.get("/calendar", {
                params: range,
                headers: authHeader(),
            });
            setEvents(res.data.events);
            setError("");
        } catch {
            setError("일정을 불러오지 못했습니다.");
        }
    }, [range]);

    const fetchRequests = useCallback(async () => {
        try {
            const res = await api.get("/calendar/requests", { headers: authHeader() });
            setRequests(res.data.requests);
        } catch {
            // 제안 목록은 없어도 달력은 봐야 하므로 조용히 넘어갑니다
        }
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const visible = useMemo(
        () =>
            onlyMyGrade && myGrade
                ? events.filter(
                      (e) => e.target_grades.length === 0 || e.target_grades.includes(myGrade),
                  )
                : events,
        [events, onlyMyGrade, myGrade],
    );

    const byDate = useMemo(() => groupByDate(visible), [visible]);
    const markers = useMemo(() => weekMarkers(events), [events]);
    const dayEvents = selected ? (byDate[selected] ?? []) : [];

    const shiftMonth = (delta: number) => {
        const next = new Date(year, month - 1 + delta, 1);
        setYear(next.getFullYear());
        setMonth(next.getMonth() + 1);
        setSelected(null);
    };

    const goToday = () => {
        const now = new Date();
        setYear(now.getFullYear());
        setMonth(now.getMonth() + 1);
        setSelected(toKey(now));
    };

    const submitForm = async (draft: EventDraft) => {
        setBusy(true);
        setFormError(null);
        const path =
            form === "personal"
                ? "/calendar/personal"
                : form === "shared"
                  ? "/calendar/events"
                  : "/calendar/requests";
        try {
            await api.post(path, draft, { headers: authHeader() });
            setForm(null);
            await Promise.all([fetchEvents(), fetchRequests()]);
        } catch (e: unknown) {
            const detail = axios.isAxiosError(e)
                ? (e.response?.data as { detail?: unknown } | undefined)?.detail
                : undefined;
            setFormError(
                typeof detail === "string" ? detail : "저장하지 못했습니다. 값을 확인해주세요.",
            );
        } finally {
            setBusy(false);
        }
    };

    const removeEvent = async (event: CalendarEvent, wholeSeries: boolean) => {
        if (!confirm(wholeSeries ? "반복 일정을 모두 지울까요?" : "이 일정을 지울까요?")) return;
        try {
            await api.delete(`/calendar/events/${event.id}`, {
                params: wholeSeries ? { series: true } : {},
                headers: authHeader(),
            });
            await fetchEvents();
        } catch {
            setError("지우지 못했습니다.");
        }
    };

    const decide = async (id: number, approve: boolean) => {
        setDecidingId(id);
        try {
            await api.post(
                `/calendar/requests/${id}/decide`,
                { approve },
                { headers: authHeader() },
            );
            await Promise.all([fetchRequests(), fetchEvents()]);
        } catch {
            setError("처리하지 못했습니다.");
        } finally {
            setDecidingId(null);
        }
    };

    const selectedWeek = selected ? weekOf(fromKey(selected), markers) : null;

    return (
        <div className="space-y-6 md:pr-12">
            <PageHeader
                title="Calendar"
                subtitle="Schedule"
                icon={CalendarDays}
                action={
                    <div className="flex items-center gap-2">
                        <RetroButton size="sm" onClick={goToday}>
                            오늘
                        </RetroButton>
                        <RetroButton
                            size="sm"
                            variant="black"
                            icon={<Plus size={14} strokeWidth={3} />}
                            onClick={() => {
                                setFormError(null);
                                setForm("personal");
                            }}
                        >
                            내 일정
                        </RetroButton>
                    </div>
                }
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => shiftMonth(-1)}
                            className="border-2 border-black bg-white p-1.5 transition-all duration-100 hover:bg-black hover:text-white"
                            aria-label="이전 달"
                        >
                            <ChevronLeft size={16} strokeWidth={3} />
                        </button>
                        <span className="min-w-32 text-center text-xl font-black tracking-tight">
                            {year}년 {MONTH_LABEL[month - 1]}
                        </span>
                        <button
                            onClick={() => shiftMonth(1)}
                            className="border-2 border-black bg-white p-1.5 transition-all duration-100 hover:bg-black hover:text-white"
                            aria-label="다음 달"
                        >
                            <ChevronRight size={16} strokeWidth={3} />
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {myGrade && (
                            <button
                                onClick={() => setOnlyMyGrade((v) => !v)}
                                className={`border-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all duration-100 ${
                                    onlyMyGrade
                                        ? "border-black bg-black text-white"
                                        : "border-black/30 bg-white text-black/40 hover:border-black hover:text-black"
                                }`}
                            >
                                {myGrade}학년 것만
                            </button>
                        )}
                        {isManager ? (
                            <RetroButton
                                size="sm"
                                onClick={() => {
                                    setFormError(null);
                                    setForm("shared");
                                }}
                            >
                                학사일정 추가
                            </RetroButton>
                        ) : (
                            <RetroButton
                                size="sm"
                                onClick={() => {
                                    setFormError(null);
                                    setForm("request");
                                }}
                            >
                                일정 제안
                            </RetroButton>
                        )}
                    </div>
                </div>
            </PageHeader>

            {error && (
                <p className="border-2 border-retro-primary bg-retro-primary/10 px-3 py-2 text-xs font-bold text-retro-primary">
                    {error}
                </p>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                <CalendarGrid
                    year={year}
                    month={month}
                    byDate={byDate}
                    markers={markers}
                    selected={selected}
                    onSelect={setSelected}
                />

                <div className="space-y-4">
                    <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                        {selected ? (
                            <>
                                <div className="flex items-baseline justify-between">
                                    <p className="text-lg font-black tracking-tight">
                                        {fromKey(selected).getMonth() + 1}월{" "}
                                        {fromKey(selected).getDate()}일
                                    </p>
                                    {selectedWeek !== null && (
                                        <span className="text-[11px] font-black uppercase tracking-widest text-black/35">
                                            {selectedWeek}주차
                                        </span>
                                    )}
                                </div>

                                {dayEvents.length === 0 && (
                                    <p className="mt-3 text-xs font-bold text-black/35">
                                        일정이 없습니다.
                                    </p>
                                )}

                                <div className="mt-3 space-y-2">
                                    {dayEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className="border-2 border-black/10 p-2.5"
                                        >
                                            <div className="flex items-start gap-2">
                                                <span
                                                    className={`mt-1 h-2 w-2 shrink-0 ${
                                                        CATEGORY_STYLE[event.category].dot
                                                    }`}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold leading-snug">
                                                        {event.title}
                                                    </p>
                                                    <p className="mt-0.5 text-[11px] font-black uppercase tracking-widest text-black/35">
                                                        {event.is_personal
                                                            ? "내 일정"
                                                            : CATEGORY_LABEL[event.category]}
                                                        {timeLabel(event) &&
                                                            ` · ${timeLabel(event)}`}
                                                        {gradeLabel(event.target_grades) &&
                                                            ` · ${gradeLabel(event.target_grades)}`}
                                                        {event.start_date !== event.end_date &&
                                                            ` · ${event.start_date} → ${event.end_date}`}
                                                    </p>
                                                    {event.note && (
                                                        <p className="mt-1 text-[13px] font-bold text-black/55">
                                                            {event.note}
                                                        </p>
                                                    )}
                                                </div>
                                                {(event.is_personal || isManager) && (
                                                    <button
                                                        onClick={() =>
                                                            removeEvent(
                                                                event,
                                                                Boolean(event.series_id),
                                                            )
                                                        }
                                                        className="shrink-0 text-black/25 transition-colors hover:text-retro-primary"
                                                        aria-label="지우기"
                                                    >
                                                        <Trash2 size={14} strokeWidth={2.5} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <RetroButton
                                    size="sm"
                                    className="mt-3 w-full"
                                    icon={<Plus size={14} strokeWidth={3} />}
                                    onClick={() => {
                                        setFormError(null);
                                        setForm("personal");
                                    }}
                                >
                                    이 날에 내 일정
                                </RetroButton>
                            </>
                        ) : (
                            <p className="text-xs font-bold text-black/35">
                                날짜를 누르면 그날 일정을 자세히 봅니다.
                            </p>
                        )}
                    </div>

                    <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                        <RetroSubTitle title="Legend" />
                        <div className="mt-2 space-y-1.5">
                            {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map(
                                (c) => (
                                    <div key={c} className="flex items-center gap-2">
                                        <span className={`h-2 w-2 ${CATEGORY_STYLE[c].dot}`} />
                                        <span className="text-[13px] font-bold text-black/60">
                                            {CATEGORY_LABEL[c]}
                                        </span>
                                    </div>
                                ),
                            )}
                            <div className="flex items-center gap-2 pt-1">
                                <span className="h-1.5 w-1.5 rotate-45 bg-retro-green" />
                                <span className="text-[13px] font-bold text-black/60">
                                    내 일정
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <RequestSidebar
                requests={requests}
                canDecide={isManager}
                busyId={decidingId}
                onDecide={decide}
            />

            {form && (
                <EventFormModal
                    purpose={form}
                    date={selected ?? toKey(addDays(new Date(year, month - 1, 1), 0))}
                    busy={busy}
                    error={formError}
                    onSubmit={submitForm}
                    onClose={() => setForm(null)}
                />
            )}
        </div>
    );
};

export default CalendarPage;
