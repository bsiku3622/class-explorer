/**
 * 로그인한 기기 — 목록과 폐기.
 *
 * ```
 * ┌ 로그인한 기기 ───────────────── 5대 중 3대 ┐
 * │ Chrome · Android      [이 기기]           │
 * │ 방금 사용                                  │
 * ├───────────────────────────────────────────┤
 * │ Safari · Mac                     [끊기]   │
 * │ 2시간 전 사용                              │
 * └───────────────────────────────────────────┘
 *              [ 다른 기기 모두 로그아웃 ]
 * ```
 *
 * **다중 기기 로그인을 열면서 같이 생긴 화면입니다.** 예전엔 로그인할 때마다 서버가
 * 기존 세션을 통째로 지웠고(1계정 1세션), 그래서 통제할 게 없었습니다. 이제 다섯 대까지
 * 동시에 살아 있으므로 **밀려난 기기가 왜 튕겼는지, 지금 뭐가 붙어 있는지** 볼 데가
 * 있어야 합니다.
 *
 * ⚠️ **"이 기기" 표시가 이 화면의 안전장치입니다.** 없으면 지금 보고 있는 세션을
 * 스스로 끊고 그 자리에서 로그인 화면으로 튕깁니다 — 서버가 `current` 를 주는 이유가
 * 그것이고, 그 줄에는 끊기 버튼을 아예 안 답니다(로그아웃 버튼이 따로 있습니다).
 *
 * ⚠️ **끊기는 두 번 눌러야 실행됩니다** (`BottomNav` 의 로그아웃과 같은 규칙).
 * 되돌릴 수 없고, 그 기기를 쓰는 사람은 다음에 열 때 이유도 모른 채 로그인 화면을
 * 봅니다. 상자는 미리 고정해 둡니다 — 안 그러면 글자가 바뀌는 순간 아래 줄이 밀립니다.
 */

import React, { useCallback, useEffect, useState } from "react";
import { MonitorSmartphone, RefreshCw } from "lucide-react";
import {
    fetchSessions,
    logoutOtherDevices,
    revokeSession,
    type DeviceSession,
} from "../lib/sessionsApi";
import RetroCard from "./atoms/RetroCard";
import RetroSubTitle from "./atoms/RetroSubTitle";
import RetroSpinner from "./atoms/RetroSpinner";

/**
 * `"2026-08-18T01:20:00"` → `"2시간 전"`.
 *
 * 절대 시각(`2026-08-18 01:20`)으로 두면 **어느 게 오래된 건지 빼기를 해야** 알 수
 * 있습니다. 여기서 하려는 일은 "안 쓰는 기기 고르기" 하나뿐이라 상대 시각이 맞습니다.
 *
 * ⚠️ 서버가 UTC 를 **시간대 표시 없이** 보냅니다(`datetime.utcnow().isoformat()`).
 * 그대로 `new Date()` 에 넣으면 브라우저가 로컬 시각으로 읽어서 한국에서는 9시간이
 * 통째로 어긋납니다 — `Z` 를 붙여 UTC 라고 알려 줘야 합니다.
 */
const timeAgo = (iso: string): string => {
    const at = new Date(/[Z+]/.test(iso) ? iso : `${iso}Z`).getTime();
    const minutes = Math.floor((Date.now() - at) / 60_000);
    if (!Number.isFinite(minutes) || minutes < 1) return "방금";
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
};

/** 옛 세션은 `device_label` 이 없습니다 — 빈 줄로 두면 고를 수가 없습니다 */
const nameOf = (session: DeviceSession): string =>
    session.device_label ?? (session.device_type === "mobile" ? "모바일" : "웹");

const DeviceSessions: React.FC = () => {
    const [sessions, setSessions] = useState<DeviceSession[]>([]);
    const [max, setMax] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** 끊기를 한 번 누른 줄 — 두 번째 누름이 실행합니다 */
    const [confirming, setConfirming] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await fetchSessions();
            setSessions(data.sessions);
            setMax(data.max);
            setError(null);
        } catch {
            setError("기기 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const handleRevoke = async (id: number) => {
        if (confirming !== id) {
            setConfirming(id);
            return;
        }
        setBusy(true);
        try {
            await revokeSession(id);
            setConfirming(null);
            await load();
        } catch {
            setError("기기를 끊지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const handleRevokeOthers = async () => {
        if (confirming !== -1) {
            setConfirming(-1);
            return;
        }
        setBusy(true);
        try {
            await logoutOtherDevices();
            setConfirming(null);
            await load();
        } catch {
            setError("다른 기기를 끊지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <RetroCard className="bg-white p-6">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <RetroSubTitle title="로그인한 기기" icon={MonitorSmartphone} />
                    <div className="flex shrink-0 items-center gap-2">
                        {max > 0 && (
                            <span className="text-[11px] font-bold tabular-nums text-black/35">
                                {max}대 중 {sessions.length}대
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="text-black/40 transition-colors hover:text-black"
                            aria-label="새로고침"
                        >
                            <RefreshCw size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <p className="text-xs font-bold text-black/40">
                    한 계정으로 {max || 5}대까지 동시에 쓸 수 있습니다. 그 이상 로그인하면
                    가장 오래 안 쓴 기기부터 끊깁니다.
                </p>

                {loading ? (
                    <div className="flex justify-center py-6">
                        <RetroSpinner />
                    </div>
                ) : error ? (
                    <p className="py-4 text-center text-xs font-bold text-black/40">{error}</p>
                ) : (
                    /* 줄에는 테두리를 두르지 않습니다 — 카드 안에 카드가 다섯 개 든
                       꼴이 되면 전부 같은 무게로 떠듭니다 (`design-guide.md`) */
                    <div className="divide-y divide-black/10 border-y-2 border-black">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                className="flex items-center justify-between gap-3 py-2.5"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="truncate text-sm font-black">
                                            {nameOf(session)}
                                        </span>
                                        {session.current && (
                                            <span className="shrink-0 bg-black px-1 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                                                이 기기
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-[11px] font-bold text-black/40">
                                        {timeAgo(session.last_used_at)} 사용
                                    </p>
                                </div>

                                {/* 지금 보고 있는 기기에는 끊기를 안 답니다 — 누르면 그
                                    자리에서 로그인 화면으로 튕깁니다 */}
                                {!session.current && (
                                    /* ⚠️ 상자를 먼저 고정합니다(`h-7` + `w-` 없음 대신
                                       `whitespace-nowrap`). 글자가 "끊기" ↔ "정말요?"
                                       로 바뀌는 동안 폭이 애니메이션되면 글자가 두 줄이
                                       되어 상자 밖으로 나옵니다 — `transition-colors`
                                       만 겁니다 (`design-guide.md`) */
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void handleRevoke(session.id)}
                                        onBlur={() =>
                                            setConfirming((id) =>
                                                id === session.id ? null : id,
                                            )
                                        }
                                        className={`h-7 shrink-0 whitespace-nowrap border-2 border-black px-2 text-[11px] font-black uppercase transition-colors duration-100 disabled:opacity-40 ${
                                            confirming === session.id
                                                ? "bg-black text-white"
                                                : "bg-white hover:bg-retro-accent-light"
                                        }`}
                                    >
                                        {confirming === session.id ? "정말요?" : "끊기"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 한 대뿐이면 끊을 "다른 기기" 가 없습니다 */}
                {!loading && !error && sessions.length > 1 && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRevokeOthers()}
                        onBlur={() => setConfirming((id) => (id === -1 ? null : id))}
                        className={`h-9 w-full whitespace-nowrap border-2 border-black text-xs font-black uppercase shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-colors duration-100 hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] disabled:opacity-40 ${
                            confirming === -1
                                ? "bg-black text-white"
                                : "bg-white hover:bg-retro-accent-light"
                        }`}
                    >
                        {confirming === -1
                            ? "정말 끊을까요? 한 번 더 누르세요"
                            : "다른 기기 모두 로그아웃"}
                    </button>
                )}
            </div>
        </RetroCard>
    );
};

export default DeviceSessions;
