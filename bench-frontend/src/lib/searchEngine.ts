/**
 * ksa-bench 검색 — **과목·교사·강의실만** 봅니다.
 *
 * class-explorer 의 검색 엔진은 불린 연산(`+ & / ( ) !`)·초성 매칭·학생 축까지 있는
 * 647줄짜리였습니다. 여기서는 그걸 다 걷어냈습니다. 이유는 셋입니다.
 *
 * 1. **학생은 클라이언트에 없습니다.** 명단이 응답에서 빠졌으니 훑을 대상이 없습니다.
 *    사람은 `benchApi.searchStudents()` 로 서버에 한 명씩 물어봅니다
 * 2. **다중 검색은 우회로였습니다.** 학번이 연속이라 `25-001+25-002+…` 를 허용하면
 *    한 방에 전교생이 긁힙니다. 연산자를 없애는 게 UI 규칙이 아니라 구조가 됩니다
 * 3. **초성은 열거 지렛대였습니다.** `ㄱㅊㅅ` 하나로 수십 명이 걸립니다
 *
 * 남은 문법은 두 가지뿐입니다.
 * - `t:`(`te`·`teacher`) · `r:`(`ro`·`room`) 접두사
 * - `체육4/2,3` — 과목 뒤에 분반 번호. 여러 개는 콤마로
 */

import type { SearchEntity, SectionTime, SubjectData } from "../types";
import { getKoreanName, replaceRomanNumerals } from "./utils";

export type SearchMode = "general" | "teacher" | "room";

export interface SearchResult {
    data: SubjectData[];
    entities: SearchEntity[];
    mode: SearchMode;
    stats: {
        keyword: string;
        total_subjects: number;
        total_sections: number;
    };
}

/** 로마숫자를 아라비아로 바꾸고 공백·대소문자를 지웁니다 (`영어Ⅲ` → `영어3`) */
const normalize = (value: string): string =>
    replaceRomanNumerals(value ?? "")
        .toLowerCase()
        .replace(/\s+/g, "");

const contains = (haystack: string, needle: string): boolean =>
    normalize(haystack).includes(normalize(needle));

const sectionNumber = (section: string): number => {
    const match = section.match(/\d+/);
    return match ? Number(match[0]) : 0;
};

interface ParsedQuery {
    mode: SearchMode;
    query: string;
    /** `체육4/2,3` 의 `[2, 3]`. 비어 있으면 분반을 안 가립니다 */
    sections: number[];
}

const PREFIX: Record<string, SearchMode> = {
    t: "teacher",
    te: "teacher",
    teacher: "teacher",
    r: "room",
    ro: "room",
    room: "room",
};

export const parseQuery = (searchTerm: string): ParsedQuery => {
    let query = searchTerm.trim();
    let mode: SearchMode = "general";

    if (query.includes(":")) {
        const [prefix, ...rest] = query.split(":");
        const resolved = PREFIX[prefix.trim().toLowerCase()];
        if (resolved) {
            mode = resolved;
            query = rest.join(":").trim();
        }
    }

    // `체육4/2,3` — 뒤에 붙은 분반 번호를 떼어 냅니다
    let sections: number[] = [];
    const divider = query.match(/^(.*?)\/(\d+(?:\s*,\s*\d+)*)$/);
    if (divider) {
        query = divider[1].trim();
        sections = divider[2]
            .split(",")
            .map((n) => Number(n.trim()))
            .filter((n) => !Number.isNaN(n));
    }

    return { mode, query, sections };
};

/** 분반 번호 필터를 적용해 과목을 다시 만듭니다. 남는 분반이 없으면 null */
const applySectionFilter = (
    subject: SubjectData,
    sections: number[],
): SubjectData | null => {
    if (sections.length === 0) return subject;
    const kept = subject.sections.filter((s) =>
        sections.includes(sectionNumber(s.section)),
    );
    return kept.length ? { ...subject, sections: kept } : null;
};

/** 교사·강의실을 검색 결과 카드로 묶습니다 */
const buildEntities = (
    type: "teacher" | "room",
    data: SubjectData[],
): SearchEntity[] => {
    const byName = new Map<string, { subjects: Set<string>; times: SectionTime[] }>();

    data.forEach((subject) => {
        subject.sections.forEach((section) => {
            const names =
                type === "teacher"
                    ? [section.teacher]
                    : Array.from(
                          new Set([
                              section.room,
                              ...section.times.map((t) => t.room),
                          ]),
                      );

            names.filter(Boolean).forEach((name) => {
                if (!byName.has(name)) byName.set(name, { subjects: new Set(), times: [] });
                const entry = byName.get(name)!;
                entry.subjects.add(
                    `${getKoreanName(subject.subject)}(${sectionNumber(section.section)})`,
                );
                section.times
                    .filter((t) => type === "teacher" || t.room === name)
                    .forEach((t) =>
                        entry.times.push({
                            ...t,
                            subject: subject.subject,
                            section: section.section,
                            teacher: section.teacher,
                        }),
                    );
            });
        });
    });

    return Array.from(byName.entries())
        .map(([name, entry]) => ({
            type,
            name,
            id: name,
            subject_count: entry.subjects.size,
            subjects: Array.from(entry.subjects).sort(),
            times: entry.times,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const searchInClient = (
    allData: SubjectData[],
    searchTerm: string,
): SearchResult => {
    const { mode, query, sections } = parseQuery(searchTerm);

    const matched: SubjectData[] = [];
    allData.forEach((subject) => {
        const keepSections = subject.sections.filter((section) => {
            if (!query) return true;
            if (mode === "teacher") return contains(section.teacher, query);
            if (mode === "room")
                return (
                    contains(section.room, query) ||
                    section.times.some((t) => contains(t.room, query))
                );
            // general — 과목명이 걸리면 분반 전부, 아니면 교사·강의실이 걸린 분반만
            return (
                contains(subject.subject, query) ||
                contains(subject.subject_english ?? "", query) ||
                contains(section.teacher, query) ||
                contains(section.room, query)
            );
        });

        if (keepSections.length === 0) return;
        const withSections = applySectionFilter(
            { ...subject, sections: keepSections },
            sections,
        );
        if (withSections) matched.push(withSections);
    });

    matched.sort((a, b) => a.subject.localeCompare(b.subject));

    return {
        data: matched,
        entities: mode === "general" ? [] : buildEntities(mode, matched),
        mode,
        stats: {
            keyword: query,
            total_subjects: matched.length,
            total_sections: matched.reduce((sum, s) => sum + s.sections.length, 0),
        },
    };
};
