import React, { useId, useState } from "react";
import {
    Button,
    FormField,
    Input,
    Modal,
    Notice,
    SegmentedControl,
    Select,
    Text,
    Textarea,
} from "@studio-baeks/funky-ui";
import type { EventCategory, TimeMode } from "../types";
import { CATEGORY_LABEL } from "../lib/calendar";
import { MAJOR_DIVISIONS, toggleMajors } from "../lib/majors";

export type FormPurpose = "personal" | "shared" | "request";

export interface EventDraft {
    title: string;
    start_date: string;
    end_date: string;
    time_mode: TimeMode;
    start_minute: number | null;
    end_minute: number | null;
    start_period: number | null;
    end_period: number | null;
    category: EventCategory;
    target_grades: number[];
    /** 대상 전공 트랙. 비면 전공 무관 — 학부를 고르면 두 트랙이 같이 들어갑니다 */
    target_majors: string[];
    note: string | null;
    repeat: "none" | "daily" | "weekly" | "monthly";
    repeat_until: string | null;
}

interface EventFormModalProps {
    purpose: FormPurpose;
    /** 기본값이 되는 날짜 */
    date: string;
    busy?: boolean;
    error?: string | null;
    onSubmit: (draft: EventDraft) => void;
    onClose: () => void;
}

const TITLE: Record<FormPurpose, string> = {
    personal: "내 일정 추가",
    shared: "학사일정 추가",
    request: "일정 제안",
};

const REPEATS: { value: EventDraft["repeat"]; label: string }[] = [
    { value: "none", label: "안 함" },
    { value: "daily", label: "매일" },
    { value: "weekly", label: "매주" },
    { value: "monthly", label: "매달" },
];

const TIME_MODES: { value: TimeMode; label: string }[] = [
    { value: "allday", label: "종일" },
    { value: "clock", label: "시각" },
    { value: "period", label: "교시" },
];

const toMinute = (value: string): number | null => {
    if (!value) return null;
    const [h, m] = value.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/**
 * 일정을 적는 창. 내 일정 · 학사일정 · 제안이 같은 칸을 쓰므로 하나로 둡니다.
 *
 * **시간은 종일 · 시각 · 교시 중에 고릅니다.** 학교 일정은 대개 종일이고, 개인 일정은
 * "화요일 7교시"처럼 교시로 적는 게 이 학교에선 더 자연스러워서 둘 다 받습니다.
 */
const EventFormModal: React.FC<EventFormModalProps> = ({
    purpose,
    date,
    busy = false,
    error = null,
    onSubmit,
    onClose,
}) => {
    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState(date);
    const [endDate, setEndDate] = useState(date);
    const [timeMode, setTimeMode] = useState<TimeMode>("allday");
    const [startClock, setStartClock] = useState("");
    const [endClock, setEndClock] = useState("");
    const [startPeriod, setStartPeriod] = useState(1);
    const [endPeriod, setEndPeriod] = useState(1);
    const [category, setCategory] = useState<EventCategory>("event");
    const [grades, setGrades] = useState<number[]>([]);
    const [majors, setMajors] = useState<string[]>([]);
    const [note, setNote] = useState("");
    const [repeat, setRepeat] = useState<EventDraft["repeat"]>("none");
    const [repeatUntil, setRepeatUntil] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (
            e.nativeEvent instanceof KeyboardEvent &&
            (e.nativeEvent as KeyboardEvent & { isComposing: boolean }).isComposing
        )
            return;
        onSubmit({
            title: title.trim(),
            start_date: startDate,
            end_date: endDate || startDate,
            time_mode: timeMode,
            start_minute: timeMode === "clock" ? toMinute(startClock) : null,
            end_minute: timeMode === "clock" ? toMinute(endClock) : null,
            start_period: timeMode === "period" ? startPeriod : null,
            end_period: timeMode === "period" ? endPeriod : null,
            category,
            target_grades: grades,
            target_majors: majors,
            note: note.trim() || null,
            repeat,
            repeat_until: repeat === "none" ? null : repeatUntil || null,
        });
    };

    const formId = useId();
    const categoryOptions = (Object.keys(CATEGORY_LABEL) as EventCategory[]).map((c) => ({
        value: c,
        label: CATEGORY_LABEL[c],
    }));

    return (
        <Modal
            open
            onClose={onClose}
            title={TITLE[purpose]}
            dismissible={false}
            footer={
                <>
                    <Button type="button" size="sm" variant="paper" shadow onClick={onClose}>
                        취소
                    </Button>
                    <Button
                        type="submit"
                        form={formId}
                        size="sm"
                        variant="filled"
                        shadow
                        disabled={busy}
                    >
                        {busy ? "저장 중..." : purpose === "request" ? "제안하기" : "추가"}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="space-y-4">
                <FormField label="제목">
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                        required
                        maxLength={200}
                    />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                    <FormField label="시작">
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                if (endDate < e.target.value) setEndDate(e.target.value);
                            }}
                            required
                        />
                    </FormField>
                    <FormField label="끝 (하루면 그대로)">
                        <Input
                            type="date"
                            value={endDate}
                            min={startDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </FormField>
                </div>

                <div>
                    <Text as="p" variant="overline" className="mb-1">시간</Text>
                    <SegmentedControl
                        aria-label="시간"
                        size="xs"
                        options={TIME_MODES}
                        value={timeMode}
                        onChange={setTimeMode}
                    />
                    {timeMode === "clock" && (
                        <div className="mt-2 flex items-center gap-2">
                            <Input
                                type="time"
                                aria-label="시작 시각"
                                value={startClock}
                                onChange={(e) => setStartClock(e.target.value)}
                                required
                            />
                            <Text variant="caption" tone="faint">–</Text>
                            <Input
                                type="time"
                                aria-label="끝 시각"
                                value={endClock}
                                onChange={(e) => setEndClock(e.target.value)}
                            />
                        </div>
                    )}
                    {timeMode === "period" && (
                        <div className="mt-2 flex items-center gap-2">
                            <Select
                                aria-label="시작 교시"
                                className="flex-1"
                                value={startPeriod}
                                onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setStartPeriod(v);
                                    if (endPeriod < v) setEndPeriod(v);
                                }}
                            >
                                {Array.from({ length: 11 }, (_, i) => i + 1).map((p) => (
                                    <option key={p} value={p}>{p}교시</option>
                                ))}
                            </Select>
                            <Text variant="caption" tone="faint">–</Text>
                            <Select
                                aria-label="끝 교시"
                                className="flex-1"
                                value={endPeriod}
                                onChange={(e) => setEndPeriod(Number(e.target.value))}
                            >
                                {Array.from({ length: 11 }, (_, i) => i + 1)
                                    .filter((p) => p >= startPeriod)
                                    .map((p) => (
                                        <option key={p} value={p}>{p}교시</option>
                                    ))}
                            </Select>
                        </div>
                    )}
                </div>

                {purpose !== "personal" && (
                    <>
                        <div>
                            <Text as="p" variant="overline" className="mb-1">성격</Text>
                            <SegmentedControl
                                aria-label="성격"
                                size="xs"
                                options={categoryOptions}
                                value={category}
                                onChange={setCategory}
                            />
                        </div>
                        <div>
                            <Text as="p" variant="overline" className="mb-1">대상 학년 (안 고르면 전학년)</Text>
                            <div className="flex gap-1.5">
                                {[1, 2, 3].map((g) => (
                                    <Button
                                        key={g}
                                        size="xs"
                                        variant="muted"
                                        selected={grades.includes(g)}
                                        onClick={() =>
                                            setGrades((prev) =>
                                                prev.includes(g)
                                                    ? prev.filter((x) => x !== g)
                                                    : [...prev, g].sort(),
                                            )
                                        }
                                    >
                                        {g}학년
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Text as="p" variant="overline" className="mb-1">대상 전공 (안 고르면 전공 무관)</Text>
                            {/* 공지는 학부 단위로 오는 일이 많아서("물리지구과학부 주관") 학부
                                칩이 두 트랙을 한꺼번에 고릅니다 */}
                            <div className="space-y-1.5">
                                {MAJOR_DIVISIONS.map(({ division, majors: pair }) => (
                                    <div key={division} className="flex flex-wrap gap-1.5">
                                        <Button
                                            size="xs"
                                            variant="muted"
                                            selected={pair.every((m) => majors.includes(m))}
                                            onClick={() => setMajors((prev) => toggleMajors(prev, pair))}
                                        >
                                            {division}
                                        </Button>
                                        {pair.map((m) => (
                                            <Button
                                                key={m}
                                                size="xs"
                                                variant="muted"
                                                selected={majors.includes(m)}
                                                onClick={() => setMajors((prev) => toggleMajors(prev, [m]))}
                                            >
                                                {m}
                                            </Button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {purpose !== "request" && (
                    <div>
                        <Text as="p" variant="overline" className="mb-1">반복</Text>
                        <SegmentedControl
                            aria-label="반복"
                            size="xs"
                            options={REPEATS}
                            value={repeat}
                            onChange={setRepeat}
                        />
                        {repeat !== "none" && (
                            <Input
                                type="date"
                                aria-label="반복 종료일"
                                value={repeatUntil}
                                min={startDate}
                                onChange={(e) => setRepeatUntil(e.target.value)}
                                className="mt-2"
                                required
                            />
                        )}
                    </div>
                )}

                <FormField label="메모">
                    <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="resize-none"
                        rows={2}
                        maxLength={2000}
                    />
                </FormField>

                {error && <Notice role="alert">{error}</Notice>}
            </form>
        </Modal>
    );
};

export default EventFormModal;
