import React, { useState } from "react";
import { Check, ChevronRight, Inbox, X } from "lucide-react";
import type { EventRequest } from "../types";
import { CATEGORY_LABEL, gradeLabel, timeLabel } from "../lib/calendar";

interface RequestSidebarProps {
    requests: EventRequest[];
    /** 매니저면 허용·거절 버튼이 붙습니다. 아니면 내가 낸 제안을 보기만 합니다 */
    canDecide: boolean;
    busyId: number | null;
    onDecide: (id: number, approve: boolean) => void;
}

/**
 * 올라온 제안을 처리하는 옆 서랍.
 *
 * 접혀 있는 게 기본이고, **처리할 게 있으면 빨간 표시**가 붙습니다. 알림 수단이 없는
 * 앱이라 이 표시가 유일한 신호입니다.
 */
const RequestSidebar: React.FC<RequestSidebarProps> = ({
    requests,
    canDecide,
    busyId,
    onDecide,
}) => {
    const [open, setOpen] = useState(false);
    const pending = requests.filter((r) => r.status === "pending");

    return (
        <div
            className={`fixed right-0 top-20 bottom-0 z-40 flex transition-transform duration-150 ${
                open ? "translate-x-0" : "translate-x-[calc(100%-2.75rem)]"
            }`}
        >
            {/* 손잡이 — 접혀 있을 때 밖으로 나와 있는 부분입니다 */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="relative flex w-11 shrink-0 flex-col items-center gap-2 border-y-2 border-l-2 border-black bg-white py-4"
            >
                <ChevronRight
                    size={16}
                    strokeWidth={3}
                    className={`transition-transform duration-150 ${open ? "" : "rotate-180"}`}
                />
                <Inbox size={16} strokeWidth={2.5} />
                <span className="text-[10px] font-black uppercase tracking-widest [writing-mode:vertical-rl]">
                    Requests
                </span>
                {/* 빨간 표시는 "처리할 게 있다"는 뜻이라 매니저에게만 붙입니다.
                    내가 낸 제안이 기다리는 중인 건 내가 할 일이 아닙니다 */}
                {canDecide && pending.length > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center bg-retro-primary px-1 text-[9px] font-black text-white">
                        {pending.length}
                    </span>
                )}
            </button>

            <div className="w-80 overflow-y-auto border-y-2 border-l-2 border-black bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    {canDecide ? "처리 대기" : "내가 낸 제안"}
                </p>

                {requests.length === 0 && (
                    <p className="mt-4 text-xs font-bold text-black/35">
                        {canDecide ? "처리할 제안이 없습니다." : "아직 낸 제안이 없습니다."}
                    </p>
                )}

                <div className="mt-3 space-y-3">
                    {requests.map((req) => (
                        <div
                            key={req.id}
                            className="border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_rgba(0,0,0,0.1)]"
                        >
                            <p className="text-sm font-black leading-tight">{req.title}</p>
                            <p className="mt-1 text-[11px] font-bold text-black/50">
                                {req.start_date}
                                {req.end_date !== req.start_date && ` → ${req.end_date}`}
                                {timeLabel(req) && ` · ${timeLabel(req)}`}
                            </p>
                            <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-black/35">
                                {CATEGORY_LABEL[req.category]}
                                {gradeLabel(req.target_grades) &&
                                    ` · ${gradeLabel(req.target_grades)}`}
                                {` · ${req.requested_by}`}
                            </p>
                            {req.note && (
                                <p className="mt-1.5 border-l-2 border-black/10 pl-2 text-[11px] font-bold text-black/60">
                                    {req.note}
                                </p>
                            )}

                            {canDecide ? (
                                <div className="mt-2.5 flex gap-1.5">
                                    <button
                                        onClick={() => onDecide(req.id, true)}
                                        disabled={busyId === req.id}
                                        className="flex flex-1 items-center justify-center gap-1 border-2 border-black bg-black px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
                                    >
                                        <Check size={12} strokeWidth={3} /> 허용
                                    </button>
                                    <button
                                        onClick={() => onDecide(req.id, false)}
                                        disabled={busyId === req.id}
                                        className="flex flex-1 items-center justify-center gap-1 border-2 border-retro-primary px-2 py-1 text-[10px] font-black uppercase tracking-widest text-retro-primary disabled:opacity-40"
                                    >
                                        <X size={12} strokeWidth={3} /> 거절
                                    </button>
                                </div>
                            ) : (
                                <p
                                    className={`mt-2 text-[10px] font-black uppercase tracking-widest ${
                                        req.status === "approved"
                                            ? "text-retro-green"
                                            : req.status === "rejected"
                                              ? "text-retro-primary"
                                              : "text-black/35"
                                    }`}
                                >
                                    {req.status === "approved"
                                        ? "허용됨"
                                        : req.status === "rejected"
                                          ? `거절됨${req.reason ? ` — ${req.reason}` : ""}`
                                          : "기다리는 중"}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RequestSidebar;
