/**
 * 친구 — 자주 보는 사람을 등록해 두고 **공강을 맞춰 보는** 화면.
 *
 * 등록은 **단방향**입니다. 내가 추가하면 끝이고 상대의 수락이 없습니다. 남의 시간표는
 * 어차피 검색으로 한 명씩 볼 수 있으니, 이 목록은 새로 뭘 열어 주는 게 아니라
 * 북마크에 가깝습니다.
 *
 * 격자에는 **언제 수업이 있는지만** 표시합니다. 무슨 수업인지는 서버가 아예 보내지
 * 않습니다 — 공강을 맞추는 데 필요 없고, 주면 "누가 뭘 듣는지" 훑는 화면이 됩니다.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "@heroui/react";
import { Clock, Search, UserPlus, Users, X } from "lucide-react";
import type { SubjectData, Term } from "../types";
import {
    addFriend,
    fetchFriends,
    fetchFriendsBusy,
    fetchFriendsNow,
    removeFriend,
    type Friend,
    type FriendBusy,
    type FriendsNowResponse,
} from "../lib/friendsApi";
import { DAY_MAP, DAYS_ORDER, PERIODS } from "../lib/utils";
import PageHeader from "../components/molecules/PageHeader";
import RetroCard from "../components/atoms/RetroCard";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import SearchInput from "../components/atoms/SearchInput";

interface FriendsPageProps {
    term: Term | null;
    myStuId: string | null;
    /** 사람 찾기는 이미 받아 둔 학기 데이터에서 합니다 — 이 앱은 명단을 들고 있습니다 */
    allClassesData: SubjectData[];
}

const SEARCH_MIN_LENGTH = 2;
const SEARCH_LIMIT = 20;

const FriendsPage: React.FC<FriendsPageProps> = ({
    term,
    myStuId,
    allClassesData,
}) => {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [people, setPeople] = useState<FriendBusy[]>([]);
    const [now, setNow] = useState<FriendsNowResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [query, setQuery] = useState("");

    /** 학기 데이터에 들어 있는 전원 (중복 제거) */
    const everyone = useMemo(() => {
        const map = new Map<string, { stuId: string; name: string }>();
        allClassesData.forEach((subject) =>
            subject.sections.forEach((section) =>
                section.students.forEach((student) => {
                    if (!map.has(student.stuId)) map.set(student.stuId, student);
                }),
            ),
        );
        return Array.from(map.values()).sort((a, b) =>
            a.stuId.localeCompare(b.stuId),
        );
    }, [allClassesData]);

    const candidates = useMemo(() => {
        const trimmed = query.trim().toLowerCase();
        if (trimmed.length < SEARCH_MIN_LENGTH) return null;
        const hits = everyone.filter(
            (person) =>
                person.name.toLowerCase().includes(trimmed) ||
                person.stuId.toLowerCase().includes(trimmed),
        );
        return {
            students: hits.slice(0, SEARCH_LIMIT),
            has_more: hits.length > SEARCH_LIMIT,
        };
    }, [query, everyone]);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [list, busy, nowResult] = await Promise.all([
                fetchFriends(),
                fetchFriendsBusy(term),
                fetchFriendsNow(term),
            ]);
            setFriends(list);
            setPeople(busy.people);
            setNow(nowResult);
        } catch {
            setError("친구 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }, [term]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const handleAdd = async (stuId: string) => {
        try {
            await addFriend(stuId);
            setQuery("");
            await reload();
        } catch {
            setError("추가하지 못했습니다.");
        }
    };

    const handleRemove = async (stuId: string) => {
        try {
            await removeFriend(stuId);
            await reload();
        } catch {
            setError("삭제하지 못했습니다.");
        }
    };

    /** `"MON-3"` → 그 칸에 수업이 있는 사람 수 */
    const busyCount = useMemo(() => {
        const map = new Map<string, number>();
        people.forEach((person) =>
            person.busy.forEach((slot) =>
                map.set(slot, (map.get(slot) ?? 0) + 1),
            ),
        );
        return map;
    }, [people]);

    const alreadyAdded = useMemo(
        () => new Set(friends.map((f) => f.stuId)),
        [friends],
    );

    return (
        <div className="flex flex-col gap-4 pb-20 md:gap-6">
            <PageHeader
                title="Friends"
                subtitle={`${friends.length} Registered`}
                icon={Users}
            />

            {/* 추가 */}
            <RetroCard className="bg-white p-5 md:p-6">
                <RetroSubTitle title="Add" icon={UserPlus} />
                <div className="mt-3">
                    <SearchInput
                        value={query}
                        onChange={setQuery}
                        placeholder="이름이나 학번 두 글자 이상…"
                    />
                </div>

                {candidates && (
                    <div className="mt-3 border-2 border-black">
                        {candidates.has_more && (
                            <p className="flex items-center gap-2 border-b-2 border-black/10 bg-retro-accent1/20 px-4 py-2 text-xs font-bold text-black/60">
                                <Search size={13} strokeWidth={2.5} />
                                20명까지만 보여 줍니다. 더 구체적으로 입력해 주세요.
                            </p>
                        )}
                        {candidates.students.length === 0 ? (
                            <p className="px-4 py-4 text-sm font-bold text-black/40">
                                찾은 사람이 없습니다.
                            </p>
                        ) : (
                            candidates.students.map((student) => {
                                const isMe = student.stuId === myStuId;
                                const added = alreadyAdded.has(student.stuId);
                                return (
                                    <button
                                        key={student.stuId}
                                        disabled={isMe || added}
                                        onClick={() => handleAdd(student.stuId)}
                                        className="flex w-full items-center justify-between gap-4 border-b-2 border-black/10 px-4 py-2.5 text-left transition-colors duration-100 last:border-b-0 hover:bg-retro-accent1/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                                    >
                                        <span className="flex items-center gap-3">
                                            <span className="text-xs font-black tabular-nums text-black/40">
                                                {student.stuId}
                                            </span>
                                            <span className="text-sm font-black">
                                                {student.name}
                                            </span>
                                        </span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                                            {isMe ? "나" : added ? "등록됨" : "추가"}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </RetroCard>

            {error && (
                <div className="border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black/60">
                    {error}
                </div>
            )}

            {/* 지금 — 서버 시계 기준입니다 */}
            {now && !loading && (
                <RetroCard className="bg-white p-5 md:p-6">
                    <RetroSubTitle title="Right Now" icon={Clock} />
                    <p className="mt-2 text-sm font-black">
                        {now.now}
                        {now.day === null ? (
                            <span className="ml-2 font-bold text-black/40">
                                주말입니다
                            </span>
                        ) : now.period !== null ? (
                            <span className="ml-2 font-bold text-black/60">
                                {now.period}교시
                                {now.break_name && ` · ${now.break_name}`}
                            </span>
                        ) : (
                            <span className="ml-2 font-bold text-black/40">
                                {now.break_name ?? "수업 시간이 아닙니다"}
                                {now.next_period &&
                                    ` · 다음 ${now.next_period.period}교시 ${now.next_period.start}`}
                            </span>
                        )}
                    </p>

                    {now.period !== null && (
                        <div className="mt-4">
                            {(() => {
                                const free = now.people.filter((p) => p.free && !p.is_me);
                                if (friends.length === 0) return null;
                                return free.length === 0 ? (
                                    <p className="text-sm font-bold text-black/40">
                                        지금은 다들 수업 중입니다.
                                    </p>
                                ) : (
                                    <>
                                        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-black/40">
                                            지금 공강 {free.length}명
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {free.map((person) => (
                                                <span
                                                    key={person.stuId}
                                                    className="border-2 border-black bg-retro-accent3 px-3 py-1.5 text-sm font-black"
                                                >
                                                    {person.name}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </RetroCard>
            )}

            {loading ? (
                <div className="flex flex-col items-center gap-3 py-16">
                    <Spinner color="primary" size="lg" />
                </div>
            ) : friends.length === 0 ? (
                <div className="border-2 border-black bg-white px-5 py-12 text-center shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                    <p className="text-sm font-bold text-black/50">
                        아직 등록한 사람이 없습니다. 위에서 이름이나 학번으로 추가해 보세요.
                    </p>
                </div>
            ) : (
                <>
                    {/* 목록 */}
                    <RetroCard className="bg-white p-5 md:p-6">
                        <RetroSubTitle title="Registered" icon={Users} />
                        <div className="mt-4 flex flex-wrap gap-2">
                            {friends.map((friend) => (
                                <span
                                    key={friend.stuId}
                                    className="flex items-center gap-2 border-2 border-black px-3 py-1.5"
                                >
                                    <span className="text-xs font-black tabular-nums text-black/40">
                                        {friend.stuId}
                                    </span>
                                    <span className="text-sm font-black">{friend.name}</span>
                                    <button
                                        onClick={() => handleRemove(friend.stuId)}
                                        aria-label={`${friend.name} 삭제`}
                                        className="text-black/30 transition-colors hover:text-black"
                                    >
                                        <X size={14} strokeWidth={3} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </RetroCard>

                    {/* 공강 격자 */}
                    <RetroCard className="bg-white p-5 md:p-6">
                        <RetroSubTitle title="Free Together" />
                        <p className="mt-2 text-xs font-bold text-black/40">
                            나를 포함해 {people.length}명 기준입니다. 무슨 수업인지는
                            보여 주지 않습니다 — 언제 비는지만 봅니다.
                        </p>

                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full min-w-[480px] border-collapse">
                                <thead>
                                    <tr>
                                        <th className="w-10 border-2 border-black bg-black/5 p-1 text-[10px] font-black" />
                                        {DAYS_ORDER.map((day) => (
                                            <th
                                                key={day}
                                                className="border-2 border-black bg-black/5 p-1 text-xs font-black"
                                            >
                                                {DAY_MAP[day]}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {PERIODS.map((period) => (
                                        <tr key={period}>
                                            <td className="border-2 border-black bg-black/5 p-1 text-center text-[10px] font-black tabular-nums">
                                                {period}
                                            </td>
                                            {DAYS_ORDER.map((day) => {
                                                const busy =
                                                    busyCount.get(`${day}-${period}`) ?? 0;
                                                const allFree = busy === 0;
                                                return (
                                                    <td
                                                        key={day}
                                                        className={`border-2 border-black p-1 text-center text-[11px] font-black tabular-nums ${
                                                            allFree
                                                                ? "bg-retro-accent3"
                                                                : "text-black/30"
                                                        }`}
                                                        title={
                                                            allFree
                                                                ? "다 비어 있습니다"
                                                                : `${busy}명 수업 중`
                                                        }
                                                    >
                                                        {allFree ? "FREE" : busy}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </RetroCard>
                </>
            )}
        </div>
    );
};

export default FriendsPage;
