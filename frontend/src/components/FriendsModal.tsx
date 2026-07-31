/**
 * 친구 목록 — 홈의 "지금 공강인 친구" 를 누르면 열립니다.
 *
 * 탭으로 두지 않은 이유는 시간표를 겹쳐 보는 일은 이미 Trade 의 Timetable Compare 가
 * 하고 있어서입니다. 여기서는 **누구를 등록해 뒀는지와 지금 비어 있는지**만 봅니다.
 *
 * 등록은 **단방향**입니다 — 추가하면 끝이고 상대의 수락이 없습니다. 이 앱은 어차피
 * 학기 전체 데이터를 들고 있어서 승인 절차를 붙여도 막아 주는 게 없습니다.
 */

import React, { useMemo, useState } from "react";
import { Spinner } from "@heroui/react";
import { Search, UserPlus, X } from "lucide-react";
import type { SubjectData } from "../types";
import { addFriend, removeFriend, type Friend } from "../lib/friendsApi";
import RetroSubTitle from "./atoms/RetroSubTitle";
import SearchInput from "./atoms/SearchInput";

const SEARCH_MIN_LENGTH = 2;
const SEARCH_LIMIT = 20;

interface FriendsModalProps {
    open: boolean;
    onClose: () => void;
    /** 지금 공강인 친구 (홈이 이미 받아 온 값) */
    free: Friend[];
    /** 수업 시간이 아니면 "공강" 을 따지지 않습니다 */
    counted: boolean;
    myStuId: string | null;
    /** 사람 찾기는 이미 받아 둔 학기 데이터에서 합니다 */
    allClassesData: SubjectData[];
    friends: Friend[];
    /** 추가·삭제 뒤 홈이 다시 받아 오도록 */
    onChanged: () => void | Promise<void>;
}

const FriendsModal: React.FC<FriendsModalProps> = ({
    open,
    onClose,
    free,
    counted,
    myStuId,
    allClassesData,
    friends,
    onChanged,
}) => {
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);

    const everyone = useMemo(() => {
        const map = new Map<string, Friend>();
        allClassesData.forEach((subject) =>
            subject.sections.forEach((section) =>
                section.students.forEach((student) => {
                    if (!map.has(student.stuId)) map.set(student.stuId, student);
                }),
            ),
        );
        return Array.from(map.values()).sort((a, b) => a.stuId.localeCompare(b.stuId));
    }, [allClassesData]);

    const candidates = useMemo(() => {
        const trimmed = query.trim().toLowerCase();
        if (trimmed.length < SEARCH_MIN_LENGTH) return null;
        const hits = everyone.filter(
            (person) =>
                person.name.toLowerCase().includes(trimmed) ||
                person.stuId.toLowerCase().includes(trimmed),
        );
        return { students: hits.slice(0, SEARCH_LIMIT), hasMore: hits.length > SEARCH_LIMIT };
    }, [query, everyone]);

    const registered = useMemo(() => new Set(friends.map((f) => f.stuId)), [friends]);
    const freeIds = useMemo(() => new Set(free.map((f) => f.stuId)), [free]);

    if (!open) return null;

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await action();
            await onChanged();
            setQuery("");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg border-2 border-black bg-white shadow-[8px_8px_0_0_rgba(0,0,0,0.3)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b-2 border-black px-5 py-3">
                    <RetroSubTitle title={`Friends (${friends.length})`} />
                    <button
                        onClick={onClose}
                        aria-label="닫기"
                        className="text-black/40 transition-colors hover:text-black"
                    >
                        <X size={18} strokeWidth={3} />
                    </button>
                </div>

                <div className="space-y-5 p-5">
                    {/* 추가 */}
                    <div>
                        <RetroSubTitle title="Add" icon={UserPlus} />
                        <div className="mt-2">
                            <SearchInput
                                value={query}
                                onChange={setQuery}
                                placeholder="이름이나 학번 두 글자 이상…"
                            />
                        </div>
                        {candidates && (
                            <div className="mt-2 max-h-52 overflow-y-auto border-2 border-black">
                                {candidates.hasMore && (
                                    <p className="flex items-center gap-2 border-b-2 border-black/10 bg-retro-accent1/20 px-3 py-2 text-xs font-bold text-black/60">
                                        <Search size={12} strokeWidth={2.5} />
                                        20명까지만 보여 줍니다. 더 구체적으로 입력해 주세요.
                                    </p>
                                )}
                                {candidates.students.length === 0 ? (
                                    <p className="px-3 py-3 text-sm font-bold text-black/40">
                                        찾은 사람이 없습니다.
                                    </p>
                                ) : (
                                    candidates.students.map((person) => {
                                        const isMe = person.stuId === myStuId;
                                        const added = registered.has(person.stuId);
                                        return (
                                            <button
                                                key={person.stuId}
                                                disabled={isMe || added || busy}
                                                onClick={() => run(() => addFriend(person.stuId))}
                                                className="flex w-full items-center justify-between gap-3 border-b-2 border-black/10 px-3 py-2 text-left transition-colors duration-100 last:border-b-0 hover:bg-retro-accent1/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <span className="text-xs font-black tabular-nums text-black/40">
                                                        {person.stuId}
                                                    </span>
                                                    <span className="text-sm font-black">
                                                        {person.name}
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
                    </div>

                    {/* 목록 */}
                    <div>
                        <RetroSubTitle
                            title={counted ? `Free Now (${free.length}/${friends.length})` : "Registered"}
                        />
                        {friends.length === 0 ? (
                            <p className="mt-3 text-sm font-bold text-black/40">
                                아직 등록한 사람이 없습니다.
                            </p>
                        ) : (
                            <ul className="mt-3 space-y-1.5">
                                {friends.map((friend) => {
                                    const isFree = counted && freeIds.has(friend.stuId);
                                    return (
                                        <li
                                            key={friend.stuId}
                                            className={`flex items-center justify-between gap-3 border-2 px-3 py-2 ${
                                                isFree
                                                    ? "border-black bg-retro-accent3"
                                                    : "border-black/15"
                                            }`}
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <span className="text-xs font-black tabular-nums text-black/40">
                                                    {friend.stuId}
                                                </span>
                                                <span className="text-sm font-black">
                                                    {friend.name}
                                                </span>
                                                {isFree && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                                        공강
                                                    </span>
                                                )}
                                            </span>
                                            <button
                                                disabled={busy}
                                                onClick={() =>
                                                    run(() => removeFriend(friend.stuId))
                                                }
                                                aria-label={`${friend.name} 삭제`}
                                                className="text-black/25 transition-colors hover:text-black disabled:opacity-30"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {!counted && friends.length > 0 && (
                            <p className="mt-3 text-xs font-bold text-black/30">
                                지금은 수업 시간이 아니라 공강을 따지지 않습니다.
                            </p>
                        )}
                    </div>

                    {busy && (
                        <div className="flex justify-center">
                            <Spinner size="sm" color="primary" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FriendsModal;
