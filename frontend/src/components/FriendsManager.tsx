/**
 * 친구 — 등록·삭제와 "지금 비어 있는지".
 *
 * Browse 안에 있습니다. 홈에 모달로 뒀더니 홈에서 할 일은 등록뿐인데 창을 열어야 했고,
 * 사람을 찾는 일은 어차피 Browse 가 하는 일입니다.
 *
 * **검색창은 하나입니다.** 먼저 등록한 사람을 걸러 보여 주고, 거기 없으면 그때 전교생에서
 * 찾아 추가하라고 내밉니다 — 찾기와 추가를 따로 두면 "이미 등록했나?" 를 확인하러 두
 * 곳을 봐야 합니다.
 *
 * 등록은 **단방향**입니다 — 추가하면 끝이고 상대의 수락이 없습니다. 이 앱은 어차피 학기
 * 전체 데이터를 들고 있어서 승인 절차를 붙여도 막아 주는 게 없습니다.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Users, X } from "lucide-react";
import type { SubjectData, Term } from "../types";
import {
    addFriend,
    fetchFriends,
    fetchFriendsNow,
    removeFriend,
    type Friend,
} from "../lib/friendsApi";
import SearchInput from "./atoms/SearchInput";
import { Button, Card, IconButton, Paint, SectionTitle, Spinner, Surface, Text } from "@studio-baeks/funky-ui";

/** 전교생을 훑는 건 두 글자부터. 한 글자면 이름 하나에 수십 명이 걸립니다 */
const LOOKUP_MIN_LENGTH = 2;
const LOOKUP_LIMIT = 8;

interface FriendsManagerProps {
    term: Term | null;
    myStuId: string | null;
    /** 사람 찾기는 이미 받아 둔 학기 데이터에서 합니다 */
    allClassesData: SubjectData[];
}

const matches = (person: Friend, query: string) =>
    person.name.toLowerCase().includes(query) ||
    person.stuId.toLowerCase().includes(query);

const PersonRow: React.FC<{
    person: Friend;
    highlight?: boolean;
    tag?: string;
    action: React.ReactNode;
}> = ({ person, highlight, tag, action }) => {
    const row = (
        <>
            <span className="flex min-w-0 items-center gap-2.5">
                <Text variant="caption" weight="black" tone="muted" numeric className="shrink-0">
                    {person.stuId}
                </Text>
                <Text weight="black" truncate>
                    {person.name}
                </Text>
                {tag && (
                    <Text variant="overline" tone="inherit" className="shrink-0">
                        {tag}
                    </Text>
                )}
            </span>
            {action}
        </>
    );
    const layout = "flex items-center justify-between gap-3 px-3 py-2";
    return highlight ? (
        <Paint as="li" accent="cyan" variant="solid" className={layout}>
            {row}
        </Paint>
    ) : (
        <Surface as="li" fill="none" border="soft" className={layout}>
            {row}
        </Surface>
    );
};

const FriendsManager: React.FC<FriendsManagerProps> = ({
    term,
    myStuId,
    allClassesData,
}) => {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [freeIds, setFreeIds] = useState<Set<string> | null>(null);
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);

    /** `freeIds` 가 null 이면 지금이 수업 시간이 아니라 공강을 따지지 않았다는 뜻 */
    const reload = useCallback(async () => {
        const list = await fetchFriends();
        setFriends(list);
        try {
            const now = await fetchFriendsNow(term);
            setFreeIds(
                now.period === null
                    ? null
                    : new Set(
                          now.people.filter((p) => !p.is_me && p.free).map((p) => p.stuId),
                      ),
            );
        } catch {
            setFreeIds(null);
        }
    }, [term]);

    useEffect(() => {
        void reload();
    }, [reload]);

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

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await action();
            await reload();
        } finally {
            setBusy(false);
        }
    };

    const searching = trimmed.length > 0;
    const freeCount = freeIds
        ? friends.filter((f) => freeIds.has(f.stuId)).length
        : null;

    return (
        <Card padding="0" className="p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle title={`Friends (${friends.length})`} icon={Users} />
                {freeCount !== null && friends.length > 0 && (
                    <Text variant="caption" weight="black">
                        지금 공강 {freeCount}명
                    </Text>
                )}
            </div>

            <div className="mt-3">
                <SearchInput
                    value={query}
                    onChange={setQuery}
                    size="sm"
                    placeholder="이름이나 학번으로 찾기"
                />
            </div>

            <div className="mt-4 space-y-5">
                {/* 등록한 사람 */}
                <div>
                    {shown.length === 0 ? (
                        // 검색 중이면 아래 Add 목록이 답입니다 — 여기서 먼저 말을 걸면
                        // 찾은 사람을 가립니다
                        !searching && (
                            <Text as="p" tone="muted">
                                아직 등록한 사람이 없습니다. 이름으로 찾아 추가해 보세요.
                            </Text>
                        )
                    ) : (
                        <>
                            <ul className="space-y-1.5">
                                {shown.map((friend) => {
                                    const isFree = freeIds?.has(friend.stuId) ?? false;
                                    return (
                                        <PersonRow
                                            key={friend.stuId}
                                            person={friend}
                                            highlight={isFree}
                                            tag={isFree ? "공강" : undefined}
                                            action={
                                                <IconButton
                                                    icon={X}
                                                    size="xs"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        run(() => removeFriend(friend.stuId))
                                                    }
                                                    label={`${friend.name} 삭제`}
                                                    className="shrink-0"
                                                />
                                            }
                                        />
                                    );
                                })}
                            </ul>
                            {freeIds === null && !searching && (
                                <Text as="p" variant="caption" tone="muted" className="mt-2.5">
                                    지금은 수업 시간이 아니라 공강을 따지지 않습니다.
                                </Text>
                            )}
                        </>
                    )}
                </div>

                {/* 찾았는데 등록 전인 사람 */}
                {searching &&
                    (trimmed.length < LOOKUP_MIN_LENGTH ? (
                        <Text as="p" variant="caption" tone="muted">
                            두 글자부터 전교생에서 찾습니다.
                        </Text>
                    ) : candidates.length === 0 ? (
                        shown.length === 0 && (
                            <Text as="p" tone="muted">
                                찾은 사람이 없습니다.
                            </Text>
                        )
                    ) : (
                        <div>
                            <SectionTitle title="Add" />
                            <ul className="mt-2.5 space-y-1.5">
                                {candidates.map((person) => (
                                    <PersonRow
                                        key={person.stuId}
                                        person={person}
                                        action={
                                            <Button
                                                size="sm"
                                                variant="paper"
                                                shadow
                                                disabled={busy}
                                                onClick={() => run(() => addFriend(person.stuId))}
                                                className="shrink-0"
                                            >
                                                추가
                                            </Button>
                                        }
                                    />
                                ))}
                            </ul>
                        </div>
                    ))}

                {busy && (
                    <div className="flex justify-center">
                        <Spinner size="sm" />
                    </div>
                )}
            </div>
        </Card>
    );
};

export default FriendsManager;
