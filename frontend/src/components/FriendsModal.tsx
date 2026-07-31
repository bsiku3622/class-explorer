/**
 * 친구 목록 — 홈의 "지금 공강인 친구" 를 누르면 열립니다.
 *
 * 탭으로 두지 않은 이유는 시간표를 겹쳐 보는 일은 이미 Trade 의 Timetable Compare 가
 * 하고 있어서입니다. 여기서는 **누구를 등록해 뒀는지와 지금 비어 있는지**만 봅니다.
 *
 * **검색창은 하나입니다.** 먼저 등록한 사람을 걸러 보여 주고, 거기 없으면 그때
 * 전교생에서 찾아 추가하라고 내밉니다 — 찾기와 추가를 따로 두면 "이미 등록했나?" 를
 * 확인하러 두 곳을 봐야 합니다.
 *
 * 등록은 **단방향**입니다 — 추가하면 끝이고 상대의 수락이 없습니다. 이 앱은 어차피
 * 학기 전체 데이터를 들고 있어서 승인 절차를 붙여도 막아 주는 게 없습니다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Spinner } from "@heroui/react";
import { X } from "lucide-react";
import type { SubjectData } from "../types";
import { addFriend, removeFriend, type Friend } from "../lib/friendsApi";
import RetroButton from "./atoms/RetroButton";
import RetroSubTitle from "./atoms/RetroSubTitle";
import SearchInput from "./atoms/SearchInput";

/** 전교생을 훑는 건 두 글자부터. 한 글자면 이름 하나에 수십 명이 걸립니다 */
const LOOKUP_MIN_LENGTH = 2;
const LOOKUP_LIMIT = 8;

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

const matches = (person: Friend, query: string) =>
    person.name.toLowerCase().includes(query) ||
    person.stuId.toLowerCase().includes(query);

const PersonRow: React.FC<{
    person: Friend;
    highlight?: boolean;
    tag?: string;
    action: React.ReactNode;
}> = ({ person, highlight, tag, action }) => (
    <li
        className={`flex items-center justify-between gap-3 border-2 px-3 py-2 ${
            highlight ? "border-black bg-retro-accent3" : "border-black/15"
        }`}
    >
        <span className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 text-xs font-black tabular-nums text-black/40">
                {person.stuId}
            </span>
            <span className="truncate text-sm font-black">{person.name}</span>
            {tag && (
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest">
                    {tag}
                </span>
            )}
        </span>
        {action}
    </li>
);

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

    // 열 때마다 처음부터 — 지난번 검색어가 남아 있으면 목록이 잘린 채로 열립니다
    useEffect(() => {
        if (open) setQuery("");
    }, [open]);

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

    const registered = useMemo(() => new Set(friends.map((f) => f.stuId)), [friends]);
    const freeIds = useMemo(() => new Set(free.map((f) => f.stuId)), [free]);

    const trimmed = query.trim().toLowerCase();

    /** 등록한 사람 중 검색어에 걸리는 것 */
    const shown = useMemo(
        () => (trimmed ? friends.filter((f) => matches(f, trimmed)) : friends),
        [friends, trimmed],
    );

    /** 아직 등록하지 않은 사람. 검색했을 때만 내밉니다 */
    const candidates = useMemo(() => {
        if (trimmed.length < LOOKUP_MIN_LENGTH) return [];
        return everyone
            .filter(
                (person) =>
                    person.stuId !== myStuId &&
                    !registered.has(person.stuId) &&
                    matches(person, trimmed),
            )
            .slice(0, LOOKUP_LIMIT);
    }, [everyone, myStuId, registered, trimmed]);

    if (!open) return null;

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await action();
            await onChanged();
        } finally {
            setBusy(false);
        }
    };

    const searching = trimmed.length > 0;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className="flex max-h-[85vh] w-full max-w-md flex-col border-2 border-black bg-white shadow-[8px_8px_0_0_rgba(0,0,0,0.3)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-black px-4 py-3">
                    <RetroSubTitle title={`Friends (${friends.length})`} />
                    <button
                        onClick={onClose}
                        aria-label="닫기"
                        className="text-black/40 transition-colors hover:text-black"
                    >
                        <X size={18} strokeWidth={3} />
                    </button>
                </div>

                <div className="shrink-0 border-b-2 border-black/10 p-4">
                    <SearchInput
                        value={query}
                        onChange={setQuery}
                        size="sm"
                        autoFocus
                        placeholder="이름이나 학번으로 찾기"
                    />
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                    {/* 등록한 사람 */}
                    <div>
                        {shown.length === 0 ? (
                            // 검색 중이면 아래 Add 목록이 답입니다 — 여기서 먼저 말을 걸면
                            // 찾은 사람을 가립니다
                            !searching && (
                                <p className="text-sm font-bold text-black/30">
                                    아직 등록한 사람이 없습니다. 이름으로 찾아 추가해
                                    보세요.
                                </p>
                            )
                        ) : (
                            <>
                                <RetroSubTitle
                                    title={
                                        counted && !searching
                                            ? `Free Now (${free.length}/${friends.length})`
                                            : "Registered"
                                    }
                                />
                                <ul className="mt-2.5 space-y-1.5">
                                    {shown.map((friend) => {
                                        const isFree = counted && freeIds.has(friend.stuId);
                                        return (
                                            <PersonRow
                                                key={friend.stuId}
                                                person={friend}
                                                highlight={isFree}
                                                tag={isFree ? "공강" : undefined}
                                                action={
                                                    <button
                                                        disabled={busy}
                                                        onClick={() =>
                                                            run(() =>
                                                                removeFriend(friend.stuId),
                                                            )
                                                        }
                                                        aria-label={`${friend.name} 삭제`}
                                                        className="shrink-0 text-black/25 transition-colors hover:text-black disabled:opacity-30"
                                                    >
                                                        <X size={14} strokeWidth={3} />
                                                    </button>
                                                }
                                            />
                                        );
                                    })}
                                </ul>
                                {!counted && !searching && (
                                    <p className="mt-2.5 text-xs font-bold text-black/30">
                                        지금은 수업 시간이 아니라 공강을 따지지 않습니다.
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* 찾았는데 등록 전인 사람 */}
                    {searching &&
                        (trimmed.length < LOOKUP_MIN_LENGTH ? (
                            <p className="text-xs font-bold text-black/30">
                                두 글자부터 전교생에서 찾습니다.
                            </p>
                        ) : candidates.length === 0 ? (
                            shown.length === 0 && (
                                <p className="text-sm font-bold text-black/30">
                                    찾은 사람이 없습니다.
                                </p>
                            )
                        ) : (
                            <div>
                                <RetroSubTitle title="Add" />
                                <ul className="mt-2.5 space-y-1.5">
                                    {candidates.map((person) => (
                                        <PersonRow
                                            key={person.stuId}
                                            person={person}
                                            action={
                                                <RetroButton
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        run(() => addFriend(person.stuId))
                                                    }
                                                    className="shrink-0 disabled:opacity-40"
                                                >
                                                    추가
                                                </RetroButton>
                                            }
                                        />
                                    ))}
                                </ul>
                            </div>
                        ))}

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
