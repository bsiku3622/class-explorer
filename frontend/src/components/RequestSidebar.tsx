import React, { useState } from "react";
import { Check, ChevronLeft, Inbox, X } from "lucide-react";
import { Badge, Button, Card, Drawer, Surface, Text } from "@studio-baeks/funky-ui";
import type { EventRequest } from "../types";
import { CATEGORY_LABEL, gradeLabel, timeLabel } from "../lib/calendar";
import { majorLabel } from "../lib/majors";

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
        <Drawer
            open={open}
            aria-label="Requests"
            className="w-80"
            style={{ top: "5rem" }}
            handle={
                // 손잡이 — 접혀 있을 때 밖으로 나와 있는 부분입니다
                <Button
                    variant="paper"
                    size="lg"
                    shadow
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                    icon={Inbox}
                    iconEnd={ChevronLeft}
                    className="relative h-auto w-11 flex-col px-0 py-4"
                >
                    <span className="[writing-mode:vertical-rl]">Requests</span>
                    {/* 빨간 표시는 "처리할 게 있다"는 뜻이라 매니저에게만 붙입니다.
                        내가 낸 제안이 기다리는 중인 건 내가 할 일이 아닙니다 */}
                    {canDecide && pending.length > 0 && (
                        <Badge accent="pink" variant="solid" size="sm" className="absolute right-1 top-1">
                            {pending.length}
                        </Badge>
                    )}
                </Button>
            }
        >
            <div className="p-4">
                <Text as="p" variant="overline">
                    {canDecide ? "처리 대기" : "내가 낸 제안"}
                </Text>

                {requests.length === 0 && (
                    <Text as="p" variant="caption" tone="muted" className="mt-4">
                        {canDecide ? "처리할 제안이 없습니다." : "아직 낸 제안이 없습니다."}
                    </Text>
                )}

                <div className="mt-3 space-y-3">
                    {requests.map((req) => (
                        <Card key={req.id} padding="0" className="p-3">
                            <Text as="p" weight="black">{req.title}</Text>
                            <Text as="p" variant="caption" tone="muted" className="mt-1">
                                {req.start_date}
                                {req.end_date !== req.start_date && ` → ${req.end_date}`}
                                {timeLabel(req) && ` · ${timeLabel(req)}`}
                            </Text>
                            <Text as="p" variant="overline" className="mt-0.5">
                                {CATEGORY_LABEL[req.category]}
                                {gradeLabel(req.target_grades) &&
                                    ` · ${gradeLabel(req.target_grades)}`}
                                {majorLabel(req.target_majors) &&
                                    ` · ${majorLabel(req.target_majors)}`}
                                {` · ${req.requested_by}`}
                            </Text>
                            {req.note && (
                                <Surface fill="none" border="subtle" borderSide="left" className="mt-1.5 pl-2">
                                    <Text as="p" variant="caption" tone="secondary">
                                        {req.note}
                                    </Text>
                                </Surface>
                            )}

                            {canDecide ? (
                                <div className="mt-2.5 flex gap-1.5">
                                    <Button
                                        size="xs"
                                        variant="filled"
                                        icon={Check}
                                        onClick={() => onDecide(req.id, true)}
                                        disabled={busyId === req.id}
                                        className="flex-1"
                                    >
                                        허용
                                    </Button>
                                    <Button
                                        size="xs"
                                        accent="pink"
                                        variant="outline"
                                        icon={X}
                                        onClick={() => onDecide(req.id, false)}
                                        disabled={busyId === req.id}
                                        className="flex-1"
                                    >
                                        거절
                                    </Button>
                                </div>
                            ) : (
                                <Text
                                    as="p"
                                    variant="overline"
                                    tone={
                                        req.status === "approved"
                                            ? "green"
                                            : req.status === "rejected"
                                              ? "pink"
                                              : "muted"
                                    }
                                    className="mt-2"
                                >
                                    {req.status === "approved"
                                        ? "허용됨"
                                        : req.status === "rejected"
                                          ? `거절됨${req.reason ? ` — ${req.reason}` : ""}`
                                          : "기다리는 중"}
                                </Text>
                            )}
                        </Card>
                    ))}
                </div>
            </div>
        </Drawer>
    );
};

export default RequestSidebar;
