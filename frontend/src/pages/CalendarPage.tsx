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
    MONTH_LABEL,
    addDays,
    fromKey,
    gradeLabel,
    gradeOf,
    groupByDate,
    isForMe,
    monthGrid,
    timeLabel,
    toKey,
    weekMarkers,
    weekOf,
} from "../lib/calendar";
import { majorLabel } from "../lib/majors";
import CalendarGrid from "../components/CalendarGrid";
import { CATEGORY_DOT } from "../components/calendarAccent";
import RequestSidebar from "../components/RequestSidebar";
import EventFormModal, {
    type EventDraft,
    type FormPurpose,
} from "../components/EventFormModal";
import {
    Button,
    Card,
    IconButton,
    Notice,
    PageHeader,
    SectionTitle,
    Surface,
    Swatch,
    Text,
} from "@studio-baeks/funky-ui";

interface CalendarPageProps {
    role: Role;
    /** 로그인한 계정의 학번. "내 학년·전공 것만" 의 학년을 여기서 얻습니다 */
    stuId: string | null;
    /** 계정에 적힌 전공 트랙. 아직 안 골랐거나 미정이면 `null` — 그때는 전공으로 거르지 않습니다 */
    major: string | null;
}

/**
 * 학사일정 달력.
 *
 * 학교 공용 일정과 내 개인 일정을 한 화면에 겹쳐 봅니다. 개인 일정은 나만 보이고,
 * 공용 일정을 넣고 싶으면 매니저에게 제안합니다.
 */
const CalendarPage: React.FC<CalendarPageProps> = ({ role, stuId, major }) => {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [requests, setRequests] = useState<EventRequest[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [onlyMine, setOnlyMine] = useState(false);
    const [form, setForm] = useState<FormPurpose | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [decidingId, setDecidingId] = useState<number | null>(null);
    const [error, setError] = useState("");

    const isManager = hasRole(role, "manager");
    // 보고 있는 달의 학년 — 2월과 3월 사이에서 학년이 바뀝니다
    const myGrade = gradeOf(stuId, new Date(year, month - 1, 1));
    const mineLabel = [myGrade && `${myGrade}학년`, major].filter(Boolean).join("·");

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
            onlyMine && mineLabel
                ? events.filter((e) => isForMe(e, myGrade, major))
                : events,
        [events, onlyMine, mineLabel, myGrade, major],
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
        <div className="space-y-6 pr-12">
            <PageHeader
                title="Calendar"
                subtitle="Schedule"
                icon={CalendarDays}
                action={
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="paper" shadow onClick={goToday}>
                            오늘
                        </Button>
                        <Button
                            size="sm"
                            variant="filled"
                            shadow
                            icon={Plus}
                            onClick={() => {
                                setFormError(null);
                                setForm("personal");
                            }}
                        >
                            내 일정
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <IconButton
                            icon={ChevronLeft}
                            label="이전 달"
                            size="sm"
                            variant="paper"
                            onClick={() => shiftMonth(-1)}
                        />
                        <Text as="span" variant="heading" className="min-w-32 text-center">
                            {year}년 {MONTH_LABEL[month - 1]}
                        </Text>
                        <IconButton
                            icon={ChevronRight}
                            label="다음 달"
                            size="sm"
                            variant="paper"
                            onClick={() => shiftMonth(1)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {mineLabel && (
                            <Button
                                size="sm"
                                variant="muted"
                                selected={onlyMine}
                                onClick={() => setOnlyMine((v) => !v)}
                            >
                                {mineLabel} 것만
                            </Button>
                        )}
                        {isManager ? (
                            <Button
                                size="sm"
                                variant="paper"
                                shadow
                                onClick={() => {
                                    setFormError(null);
                                    setForm("shared");
                                }}
                            >
                                학사일정 추가
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="paper"
                                shadow
                                onClick={() => {
                                    setFormError(null);
                                    setForm("request");
                                }}
                            >
                                일정 제안
                            </Button>
                        )}
                    </div>
                </div>
            </PageHeader>

            {error && <Notice role="alert">{error}</Notice>}

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
                    <Card shadow="raised" padding="0" className="p-4">
                        {selected ? (
                            <>
                                <div className="flex items-baseline justify-between">
                                    <Text as="p" variant="heading">
                                        {fromKey(selected).getMonth() + 1}월{" "}
                                        {fromKey(selected).getDate()}일
                                    </Text>
                                    {selectedWeek !== null && (
                                        <Text variant="overline">
                                            {selectedWeek}주차
                                        </Text>
                                    )}
                                </div>

                                {dayEvents.length === 0 && (
                                    <Text as="p" variant="caption" tone="muted" className="mt-3">
                                        일정이 없습니다.
                                    </Text>
                                )}

                                <div className="mt-3 space-y-2">
                                    {dayEvents.map((event) => (
                                        <Surface
                                            key={event.id}
                                            border="subtle"
                                            className="p-2.5"
                                        >
                                            <div className="flex items-start gap-2">
                                                <Swatch
                                                    {...CATEGORY_DOT[event.category]}
                                                    className="mt-1 shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <Text as="p" className="leading-snug">
                                                        {event.title}
                                                    </Text>
                                                    <Text as="p" variant="overline" className="mt-0.5">
                                                        {event.is_personal
                                                            ? "내 일정"
                                                            : CATEGORY_LABEL[event.category]}
                                                        {timeLabel(event) &&
                                                            ` · ${timeLabel(event)}`}
                                                        {gradeLabel(event.target_grades) &&
                                                            ` · ${gradeLabel(event.target_grades)}`}
                                                        {majorLabel(event.target_majors) &&
                                                            ` · ${majorLabel(event.target_majors)}`}
                                                        {event.start_date !== event.end_date &&
                                                            ` · ${event.start_date} → ${event.end_date}`}
                                                    </Text>
                                                    {event.note && (
                                                        <Text as="p" tone="secondary" className="mt-1">
                                                            {event.note}
                                                        </Text>
                                                    )}
                                                </div>
                                                {(event.is_personal || isManager) && (
                                                    <IconButton
                                                        icon={Trash2}
                                                        label="지우기"
                                                        size="xs"
                                                        accent="error"
                                                        variant="ghostMuted"
                                                        className="shrink-0"
                                                        onClick={() =>
                                                            removeEvent(
                                                                event,
                                                                Boolean(event.series_id),
                                                            )
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </Surface>
                                    ))}
                                </div>

                                <Button
                                    size="sm"
                                    variant="paper"
                                    shadow
                                    fullWidth
                                    className="mt-3"
                                    icon={Plus}
                                    onClick={() => {
                                        setFormError(null);
                                        setForm("personal");
                                    }}
                                >
                                    이 날에 내 일정
                                </Button>
                            </>
                        ) : (
                            <Text as="p" variant="caption" tone="muted">
                                날짜를 누르면 그날 일정을 자세히 봅니다.
                            </Text>
                        )}
                    </Card>

                    <Card shadow="raised" padding="0" className="p-4">
                        <SectionTitle title="Legend" />
                        <div className="mt-2 space-y-1.5">
                            {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map(
                                (c) => (
                                    <div key={c} className="flex items-center gap-2">
                                        <Swatch {...CATEGORY_DOT[c]} />
                                        <Text tone="secondary">
                                            {CATEGORY_LABEL[c]}
                                        </Text>
                                    </div>
                                ),
                            )}
                            <div className="flex items-center gap-2 pt-1">
                                <Swatch accent="green" className="rotate-45" />
                                <Text tone="secondary">
                                    내 일정
                                </Text>
                            </div>
                        </div>
                    </Card>
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
