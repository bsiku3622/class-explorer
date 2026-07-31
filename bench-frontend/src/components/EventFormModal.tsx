import React, { useState } from "react";
import { X } from "lucide-react";
import type { EventCategory, TimeMode } from "../types";
import { CATEGORY_LABEL } from "../lib/calendar";
import RetroButton from "./atoms/RetroButton";

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
            note: note.trim() || null,
            repeat,
            repeat_until: repeat === "none" ? null : repeatUntil || null,
        });
    };

    const inputClass =
        "w-full border-2 border-black px-3 py-2 text-sm font-bold bg-white outline-none";
    const labelClass =
        "text-[10px] font-black text-black/40 uppercase tracking-widest block mb-1";
    const pill = (active: boolean) =>
        `border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-all duration-100 ${
            active
                ? "bg-black text-white border-black"
                : "bg-white text-black/40 border-black/30 hover:border-black hover:text-black"
        }`;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border-2 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
                <div className="flex items-center justify-between border-b-2 border-black bg-retro-secondary px-5 py-3 text-white">
                    <span className="text-sm font-black uppercase tracking-widest">
                        {TITLE[purpose]}
                    </span>
                    <button onClick={onClose} className="text-white/70 hover:text-white">
                        <X size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-5">
                    <div>
                        <label className={labelClass}>제목</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className={inputClass}
                            autoFocus
                            required
                            maxLength={200}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>시작</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    if (endDate < e.target.value) setEndDate(e.target.value);
                                }}
                                className={inputClass}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>끝 (하루면 그대로)</label>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>시간</label>
                        <div className="flex gap-1.5">
                            {TIME_MODES.map((m) => (
                                <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => setTimeMode(m.value)}
                                    className={pill(timeMode === m.value)}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        {timeMode === "clock" && (
                            <div className="mt-2 flex items-center gap-2">
                                <input
                                    type="time"
                                    value={startClock}
                                    onChange={(e) => setStartClock(e.target.value)}
                                    className={inputClass}
                                    required
                                />
                                <span className="text-xs font-black text-black/30">–</span>
                                <input
                                    type="time"
                                    value={endClock}
                                    onChange={(e) => setEndClock(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                        )}
                        {timeMode === "period" && (
                            <div className="mt-2 flex items-center gap-2">
                                <select
                                    value={startPeriod}
                                    onChange={(e) => {
                                        const v = Number(e.target.value);
                                        setStartPeriod(v);
                                        if (endPeriod < v) setEndPeriod(v);
                                    }}
                                    className={inputClass}
                                >
                                    {Array.from({ length: 11 }, (_, i) => i + 1).map((p) => (
                                        <option key={p} value={p}>{p}교시</option>
                                    ))}
                                </select>
                                <span className="text-xs font-black text-black/30">–</span>
                                <select
                                    value={endPeriod}
                                    onChange={(e) => setEndPeriod(Number(e.target.value))}
                                    className={inputClass}
                                >
                                    {Array.from({ length: 11 }, (_, i) => i + 1)
                                        .filter((p) => p >= startPeriod)
                                        .map((p) => (
                                            <option key={p} value={p}>{p}교시</option>
                                        ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {purpose !== "personal" && (
                        <>
                            <div>
                                <label className={labelClass}>성격</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {(Object.keys(CATEGORY_LABEL) as EventCategory[]).map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setCategory(c)}
                                            className={pill(category === c)}
                                        >
                                            {CATEGORY_LABEL[c]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>대상 학년 (안 고르면 전학년)</label>
                                <div className="flex gap-1.5">
                                    {[1, 2, 3].map((g) => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() =>
                                                setGrades((prev) =>
                                                    prev.includes(g)
                                                        ? prev.filter((x) => x !== g)
                                                        : [...prev, g].sort(),
                                                )
                                            }
                                            className={pill(grades.includes(g))}
                                        >
                                            {g}학년
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {purpose !== "request" && (
                        <div>
                            <label className={labelClass}>반복</label>
                            <div className="flex gap-1.5">
                                {REPEATS.map((r) => (
                                    <button
                                        key={r.value}
                                        type="button"
                                        onClick={() => setRepeat(r.value)}
                                        className={pill(repeat === r.value)}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                            {repeat !== "none" && (
                                <input
                                    type="date"
                                    value={repeatUntil}
                                    min={startDate}
                                    onChange={(e) => setRepeatUntil(e.target.value)}
                                    className={`${inputClass} mt-2`}
                                    required
                                />
                            )}
                        </div>
                    )}

                    <div>
                        <label className={labelClass}>메모</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className={`${inputClass} resize-none`}
                            rows={2}
                            maxLength={2000}
                        />
                    </div>

                    {error && (
                        <p className="border-2 border-retro-primary bg-retro-primary/10 px-3 py-2 text-xs font-bold text-retro-primary">
                            {error}
                        </p>
                    )}

                    <div className="flex justify-end gap-2 border-t-2 border-black/10 pt-3">
                        <RetroButton type="button" size="sm" onClick={onClose}>
                            취소
                        </RetroButton>
                        <RetroButton type="submit" variant="black" size="sm" disabled={busy}>
                            {busy ? "저장 중..." : purpose === "request" ? "제안하기" : "추가"}
                        </RetroButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EventFormModal;
