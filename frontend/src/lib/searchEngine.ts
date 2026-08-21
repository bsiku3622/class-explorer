import {
    formatSubjectWithSection,
    DAY_MAP as dayMap,
    replaceRomanNumerals,
    getKoreanName,
} from "./utils";
import type {
    SearchEntity,
    Section,
    SectionTime,
    StudentInfo,
    SubjectData,
} from "../types";

/** 검색이 도는 방식. prefix(`teacher:`) 로 정해지고 화면 배치까지 여기서 갈립니다 */
export type SearchMode = "general" | "student" | "teacher" | "room";

/**
 * 검색에 걸린 분반 하나 — 원본 `Section` 에 **어느 과목의 것인지**가 얹힌 것입니다.
 *
 * `students` 는 **학년 필터를 통과한 사람만** 남은 명단이고 `student_count` 도 그
 * 길이입니다. 원본 `Section` 의 전체 명단이 아닙니다.
 */
export interface MatchedSection extends Section {
    subject: string;
    subject_id: number;
}

/**
 * 엔티티(사람·강의실)를 모으는 중간 모양.
 *
 * `subjectsRaw` 는 `"교사|과목"` → 분반 집합입니다. 같은 과목의 여러 분반을 한 줄로
 * 접어야 해서(`국어1(1,2)`) 마지막에야 문자열로 폅니다 — 모으는 동안은 집합이라야
 * 중복이 안 생깁니다.
 */
interface EntityDraft {
    type: SearchEntity["type"];
    name: string;
    id: string;
    subjectsRaw: Map<string, Set<string>>;
    times: SectionTime[];
}

const _CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const _chosungCache = new Map<string, string>();

/**
 * 한글 문자열에서 초성을 추출합니다. (결과 캐싱으로 중복 연산 방지)
 */
export const getChosung = (str: string): string => {
    const cached = _chosungCache.get(str);
    if (cached !== undefined) return cached;
    let result = "";
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i) - 44032;
        result += (code > -1 && code < 11172) ? _CHO[Math.floor(code / 588)] : str.charAt(i);
    }
    _chosungCache.set(str, result);
    return result;
};

const _normalizeCache = new Map<string, string>();

/**
 * 비교용 정규화: 소문자 · 로마숫자 → 아라비아 · 구분 기호 제거
 * 예) "영어Ⅲ(English III)" → "영어3english3"
 */
const normalize = (str: string): string => {
    const cached = _normalizeCache.get(str);
    if (cached !== undefined) return cached;
    // 로마숫자 치환이 먼저입니다 — toLowerCase가 "Ⅲ"를 "ⅲ"로 바꿔버리면 매칭에 실패합니다
    const result = replaceRomanNumerals(str)
        .toLowerCase()
        .replace(/[\s,./\-_()[\]]/g, "");
    _normalizeCache.set(str, result);
    return result;
};

/**
 * needle의 문자들이 haystack에 순서대로 나타나는 구간 중 가장 짧은 길이.
 * 매칭되지 않으면 Infinity.
 */
const minMatchSpan = (haystack: string, needle: string): number => {
    let best = Infinity;
    for (let start = 0; start <= haystack.length - needle.length; start++) {
        if (haystack[start] !== needle[0]) continue;
        let k = 0;
        let i = start;
        for (; i < haystack.length && k < needle.length; i++) {
            if (haystack[i] === needle[k]) k++;
        }
        if (k === needle.length && i - start < best) best = i - start;
    }
    return best;
};

/**
 * 띄엄띄엄 입력한 검색어를 매칭합니다. 예) "정3" → "정보과학3"
 *
 * 문자가 순서대로 나타나기만 하면 통과시키면 오탐이 쏟아지므로,
 * 매칭 구간이 검색어 길이에 비해 지나치게 벌어지면 탈락시킵니다.
 * "그세"가 "그림,음악,영화로보는세계사"에 걸리는 것을 막는 장치입니다.
 */
export const fuzzyMatch = (item: string, term: string): boolean => {
    if (!item || !term) return false;
    const haystack = normalize(item);
    const needle = normalize(term);
    if (!needle || !haystack) return false;

    if (haystack.includes(needle)) return true;
    if (needle.length < 2) return false;

    const limit = needle.length * 3 + 2;
    if (minMatchSpan(haystack, needle) <= limit) return true;

    // 초성이 섞인 검색어도 같은 방식으로 처리 — "ㅈㅂ3" → "정보과학3"
    return minMatchSpan(getChosung(haystack), needle) <= limit;
};

/**
 * 초성·유사도 검색을 포함한 문자열 매칭 함수
 */
const matchesItem = (item: string, term: string, strictIDMatch: boolean = false) => {
    const lowerItem = item.toLowerCase();
    const lowerTerm = term.toLowerCase();

    // 1. 학번 검색 (strictIDMatch인 경우)
    if (strictIDMatch && item.includes("-") && term.includes("-")) {
        if (term.length <= 3) return lowerItem.startsWith(lowerTerm);
        return lowerItem === lowerTerm;
    }

    // 2. 일반 포함 검색
    if (lowerItem.includes(lowerTerm)) return true;

    // 3. 초성 검색 지원
    const isChosungOnly = /^[ㄱ-ㅎ]+$/.test(lowerTerm);
    if (isChosungOnly) {
        const itemChosung = getChosung(lowerItem);
        return itemChosung.includes(lowerTerm);
    }

    // 4. 유사도 검색 — 별칭 등록 없이도 줄여 쓴 검색어를 받아냅니다
    return fuzzyMatch(item, term);
};

/**
 * 논리식 평가 함수: +, &, &&, (), ! 연산자를 지원합니다.
 */
export const evaluateBoolExpression = (
    expression: string,
    pool: string[],
    strictIDMatch: boolean = false,
): boolean => {
    const trimmedExpr = expression.trim();
    if (!trimmedExpr) return true;

    const tokens =
        trimmedExpr
            .match(/\(|\)|&&|&|\+|!|[^()+&!]+/g)
            ?.map((t) => t.trim())
            .filter((t) => t) || [];

    if (
        tokens.length === 1 &&
        !["(", ")", "+", "&", "&&", "!"].includes(tokens[0])
    ) {
        const term = tokens[0];
        return pool.some((item) => matchesItem(item, term, strictIDMatch));
    }

    let current = 0;

    const parseExpression = (): boolean => {
        let result = parseAndTerm();
        while (current < tokens.length && tokens[current] === "+") {
            current++;
            const next = parseAndTerm();
            result = result || next;
        }
        return result;
    };

    const parseAndTerm = (): boolean => {
        let result = parseUnary();
        while (
            current < tokens.length &&
            (tokens[current] === "&" || tokens[current] === "&&")
        ) {
            current++;
            const next = parseUnary();
            result = result && next;
        }
        return result;
    };

    const parseUnary = (): boolean => {
        if (current < tokens.length && tokens[current] === "!") {
            current++;
            return !parseFactor();
        }
        return parseFactor();
    };

    const parseFactor = (): boolean => {
        if (current >= tokens.length) return false;
        const token = tokens[current++];
        if (token === "(") {
            const result = parseExpression();
            if (current < tokens.length && tokens[current] === ")") current++;
            return result;
        }
        const term = token;
        return pool.some((item) => matchesItem(item, term, strictIDMatch));
    };

    try {
        return parseExpression();
    } catch {
        return false;
    }
};

export interface SearchResult {
    data: SubjectData[];
    entities: SearchEntity[];
    mode: SearchMode;
    warning?: string;
    stats: {
        keyword: string;
        total_subjects: number;
        total_sections: number;
        total_matched_students: number;
    };
}

const parseQuery = (searchTerm: string) => {
    const cleanKeyword = searchTerm.trim();
    let mode: SearchMode = "general";
    let effectiveQuery = cleanKeyword;
    let warning: string | undefined = undefined;

    // '국어1/1' 같은 과목/분반 패턴 확인. '체육4/2,3'처럼 분반 여러 개도 받습니다
    const isDividerSearch = /.+\/\d+(?:\s*,\s*\d+)*$/.test(cleanKeyword);

    if (cleanKeyword.includes(":")) {
        const [prefix, ...rest] = cleanKeyword.split(":");
        const query = rest.join(":").trim();
        const p = prefix.toLowerCase();

        if (["t", "te", "teacher"].includes(p)) {
            mode = "teacher";
            effectiveQuery = query;
        } else if (["s", "st", "student"].includes(p)) {
            mode = "student";
            effectiveQuery = query;
        } else if (["r", "ro", "room"].includes(p)) {
            mode = "room";
            effectiveQuery = query;
        }

        if (mode !== "general") {
            const hasLogic =
                effectiveQuery.includes("&") ||
                effectiveQuery.includes("+") ||
                effectiveQuery.includes("(") ||
                effectiveQuery.includes(")");
            if (hasLogic) {
                warning =
                    "인물/강의실 전용 검색 모드(:)에서는 복합 논리 연산이 제한될 수 있습니다. 전체 검색을 권장합니다.";
            }
        }
    }

    const matchBase = effectiveQuery;
    let flatTerms: string[] = [];
    if (warning) {
        flatTerms = [matchBase.toLowerCase()];
    } else {
        flatTerms = matchBase
            .split(/[+&()!]+/)
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t);
    }

    return {
        mode,
        effectiveQuery,
        flatTerms,
        warning,
        isStrictMode: searchTerm.includes("&&") || mode === "room" || isDividerSearch,
        isDividerSearch,
    };
};

const filterMatchingClasses = (
    allData: SubjectData[],
    queryParams: ReturnType<typeof parseQuery>,
    selectedYears: string[],
): MatchedSection[] => {
    const { mode, effectiveQuery, warning, isDividerSearch } = queryParams;
    const matchingClasses: MatchedSection[] = [];

    // '국어1/1' 패턴에서 과목과 분반 분리 (분반은 콤마로 여러 개 가능)
    let targetSubject = "";
    const targetSections = new Set<string>();
    if (isDividerSearch) {
        const lastSlashIndex = effectiveQuery.lastIndexOf("/");
        targetSubject = effectiveQuery.substring(0, lastSlashIndex).toLowerCase();
        effectiveQuery
            .substring(lastSlashIndex + 1)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((s) => targetSections.add(s));
    }

    allData.forEach((subject) => {
        const subjectName = subject.subject;
        subject.sections.forEach((sec: Section) => {
            const activeStudents = sec.students.filter((s) =>
                selectedYears.includes(s.stuId.split("-")[0]),
            );

            const sectionPool = [
                subjectName,
                replaceRomanNumerals(subjectName),
                // 영문 병기를 뗀 한글명 — 유사도 매칭의 정확도를 높입니다
                getKoreanName(subjectName),
                // 영문명으로도 찾을 수 있게 (Calculus, Physics ...)
                subject.subject_english,
                sec.section,
                sec.teacher,
                sec.room,
                ...(sec.times || []).flatMap((t) => [
                    t.room,
                    `${t.day}${t.period}`,
                    `${dayMap[t.day]}${t.period}`,
                ]),
                ...activeStudents.map((s) => s.stuId),
                ...activeStudents.map((s) => s.name),
            ].filter((item): item is string => Boolean(item));

            const evaluate = (expr: string, pool: string[]) => {
                if (warning && expr === effectiveQuery) {
                    return pool.some((item) =>
                        item.toLowerCase().includes(expr.toLowerCase()),
                    );
                }
                return evaluateBoolExpression(expr, pool, mode === "student");
            };

            let isSectionMatch = false;

            if (isDividerSearch) {
                // 과목명과 분반 번호가 모두 일치해야 함 (분반은 숫자만 추출해서 비교)
                // 과목명은 유사도까지 허용 — "체4/5" → 체육4 5분반
                const sectionNum = sec.section.replace(/[^0-9]/g, "");
                const subjectMatches =
                    subjectName.toLowerCase().includes(targetSubject) ||
                    fuzzyMatch(subjectName, targetSubject) ||
                    fuzzyMatch(getKoreanName(subjectName), targetSubject) ||
                    (!!subject.subject_english &&
                        fuzzyMatch(subject.subject_english, targetSubject));
                isSectionMatch = subjectMatches && targetSections.has(sectionNum);
            } else if (mode === "student") {
                isSectionMatch = evaluate(effectiveQuery, [
                    ...activeStudents.map((s) => s.stuId),
                    ...activeStudents.map((s) => s.name),
                ]);
            } else if (mode === "teacher") {
                isSectionMatch = evaluate(effectiveQuery, [sec.teacher]);
            } else if (mode === "room") {
                const searchRoom = effectiveQuery.toLowerCase();
                isSectionMatch = [sec.room, ...(sec.times || []).map((t) => t.room)]
                    .filter(Boolean)
                    .some(r => matchesItem(r, searchRoom));
            } else {
                isSectionMatch = evaluate(effectiveQuery, sectionPool);
            }

            if (isSectionMatch) {
                if (activeStudents.length === 0 && mode !== "teacher") return;
                
                matchingClasses.push({
                    ...sec,
                    subject: subjectName,
                    subject_id: subject.subject_id,
                    students: activeStudents,
                    student_count: activeStudents.length,
                });
            }
        });
    });

    return matchingClasses;
};

/**
 * 걸린 분반들에서 **사람·강의실을 뽑아 모읍니다.**
 *
 * 셋(강의실·교사·학생)이 모으는 방식이 같아서 — 없으면 만들고, 과목·분반을 더하고,
 * 시간을 겹치지 않게 붙이고 — 그 셋을 아래 세 헬퍼로 두었습니다. 예전엔 같은 20줄이
 * 세 번 반복돼 있었고, 그중 강의실 쪽만 시간에 조건이 붙어 있어서 **차이가 어디인지
 * 읽어 내려면 세 덩이를 나란히 놓고 비교해야 했습니다.**
 */
const extractEntities = (
    matchingClasses: MatchedSection[],
    flatTerms: string[],
    mode: SearchMode,
    effectiveQuery: string,
): SearchEntity[] => {
    const entityMap = new Map<string, EntityDraft>();

    /** 있으면 그것, 없으면 만들어 넣고 그것 */
    const ensure = (
        key: string,
        type: EntityDraft["type"],
        name: string,
        id: string,
    ): EntityDraft => {
        const found = entityMap.get(key);
        if (found) return found;
        const made: EntityDraft = {
            type,
            name,
            id,
            subjectsRaw: new Map<string, Set<string>>(),
            times: [],
        };
        entityMap.set(key, made);
        return made;
    };

    /** `"교사|과목"` 아래에 분반을 더합니다 */
    const addSection = (entity: EntityDraft, subKey: string, section: string) => {
        const found = entity.subjectsRaw.get(subKey);
        if (found) found.add(section);
        else entity.subjectsRaw.set(subKey, new Set([section]));
    };

    /**
     * 수업 시간을 붙입니다 — **같은 요일·교시는 한 번만**.
     *
     * `keep` 은 강의실 엔티티에만 씁니다. 한 분반이 요일마다 다른 방을 쓸 수 있어서,
     * 찾는 방에서 열리는 교시만 골라야 합니다.
     */
    const addTimes = (
        entity: EntityDraft,
        cls: MatchedSection,
        keep?: (t: SectionTime) => boolean,
    ) => {
        (cls.times || []).forEach((t) => {
            if (keep && !keep(t)) return;
            if (entity.times.some((et) => et.day === t.day && et.period === t.period))
                return;
            entity.times.push({
                ...t,
                subject: cls.subject,
                section: cls.section,
                teacher: cls.teacher,
            });
        });
    };

    matchingClasses.forEach((cls) => {
        const searchRoom = effectiveQuery.toLowerCase();
        const matchingRooms = new Set<string>();

        if (matchesItem(cls.room, searchRoom)) {
            matchingRooms.add(cls.room);
        }
        (cls.times || []).forEach((t) => {
            if (matchesItem(t.room, searchRoom)) {
                matchingRooms.add(t.room);
            }
        });

        if (mode === "room" || (mode === "general" && matchingRooms.size > 0)) {
            matchingRooms.forEach((roomName) => {
                const entity = ensure(`room_${roomName}`, "room", roomName, "Classroom");
                addSection(entity, `${cls.teacher}|${cls.subject}`, cls.section);
                addTimes(entity, cls, (t) => matchesItem(t.room, searchRoom));
            });
        }

        const classTimeStrings = (cls.times || []).flatMap((t) => [
            `${t.day}${t.period}`.toLowerCase(),
            `${dayMap[t.day]}${t.period}`.toLowerCase(),
        ]);

        const isTeacherMatch = flatTerms.some(
            (t) =>
                matchesItem(cls.teacher, t) ||
                classTimeStrings.includes(t.toLowerCase()),
        );

        if (isTeacherMatch) {
            const entity = ensure(`t_${cls.teacher}`, "teacher", cls.teacher, "Teacher");
            addSection(entity, `${cls.room}|${cls.subject}`, cls.section);
            addTimes(entity, cls);
        }

        cls.students.forEach((s: StudentInfo) => {
            const isStudentMatch = flatTerms.some(
                (t) =>
                    matchesItem(s.stuId, t) ||
                    matchesItem(s.name, t) ||
                    classTimeStrings.includes(t.toLowerCase()),
            );

            if (isStudentMatch) {
                const entity = ensure(s.stuId, "student", s.name, s.stuId);
                addSection(entity, `${cls.teacher}|${cls.subject}`, cls.section);
                addTimes(entity, cls);
            }
        });
    });

    /** 사람 먼저(교사 → 학생), 강의실은 뒤. 같은 종류면 이름·학번 순 */
    const priority: Record<EntityDraft["type"], number> = {
        teacher: 1,
        student: 2,
        room: 3,
    };

    return Array.from(entityMap.values())
        .map(({ subjectsRaw, ...rest }): SearchEntity => {
            const subjects: string[] = [];
            subjectsRaw.forEach((sections, key) => {
                const [extra, subject] = key.split("|");
                const position = rest.type === "room" ? "prefix" : "suffix";
                subjects.push(
                    formatSubjectWithSection(
                        subject,
                        Array.from(sections),
                        extra,
                        position,
                    ),
                );
            });
            return {
                ...rest,
                subject_count: subjects.length,
                subjects: subjects.sort(),
            };
        })
        .sort((a, b) => {
            if (priority[a.type] !== priority[b.type]) {
                return priority[a.type] - priority[b.type];
            }
            return a.type === "teacher" || a.type === "room"
                ? a.name.localeCompare(b.name, "ko")
                : a.id.localeCompare(b.id);
        });
};

export const searchInClient = (
    allData: SubjectData[],
    searchTerm: string,
    selectedYears: string[],
): SearchResult => {
    if (!searchTerm.trim()) {
        const filteredData = allData
            .map((subject) => ({
                ...subject,
                sections: subject.sections
                    .filter((sec) =>
                        sec.students.some((s) =>
                            selectedYears.includes(s.stuId.split("-")[0]),
                        ),
                    )
                    .map((sec) => ({
                        ...sec,
                        students: sec.students.filter((s) =>
                            selectedYears.includes(s.stuId.split("-")[0]),
                        ),
                    })),
            }))
            .filter((subject) => subject.sections.length > 0);

        const totalMatchedStudents = new Set(
            filteredData.flatMap((sub) =>
                sub.sections.flatMap((sec) => sec.students.map((s) => s.stuId)),
            ),
        ).size;

        return {
            data: filteredData,
            entities: [],
            mode: "general",
            stats: {
                keyword: "",
                total_subjects: filteredData.length,
                total_sections: filteredData.reduce(
                    (acc, s) => acc + s.sections.length,
                    0,
                ),
                total_matched_students: totalMatchedStudents,
            },
        };
    }

    const queryParams = parseQuery(searchTerm);
    const matchingClasses = filterMatchingClasses(
        allData,
        queryParams,
        selectedYears,
    );
    const entities = extractEntities(
        matchingClasses,
        queryParams.flatTerms,
        queryParams.mode,
        queryParams.effectiveQuery,
    );

    const grouped: Record<string, MatchedSection[]> = {};
    matchingClasses.forEach((cls) => {
        if (!grouped[cls.subject]) grouped[cls.subject] = [];
        grouped[cls.subject].push(cls);
    });

    const finalData = Object.keys(grouped)
        .sort()
        .map((sub) => {
            const secs = grouped[sub].sort((a, b) => {
                const aNum = parseInt(a.section.match(/\d+/)?.[0] || "0");
                const bNum = parseInt(b.section.match(/\d+/)?.[0] || "0");
                return aNum - bNum;
            });
            const subStus = new Set(
                secs.flatMap((s) => s.students.map((st) => st.stuId)),
            );
            return {
                subject: sub,
                // 같은 이름이면 같은 과목입니다 — 영어강의는 이름에 `(EC)` 가 붙어
                // 애초에 다른 키로 묶입니다
                subject_id: secs[0].subject_id,
                subject_student_count: subStus.size,
                section_count: secs.length,
                sections: secs,
            };
        });

    const totalMatchedStudents = new Set(
        matchingClasses.flatMap((cls) => cls.students.map((s) => s.stuId))
    ).size;

    return {
        data: finalData,
        entities,
        mode: queryParams.mode,
        warning: queryParams.warning,
        stats: {
            keyword: queryParams.effectiveQuery,
            total_subjects: finalData.length,
            total_sections: matchingClasses.length,
            total_matched_students: totalMatchedStudents,
        },
    };
};

// ─── 화면에서 검색으로 ────────────────────────────────────────────────────────

/**
 * 화면에 찍힌 값(과목명·교사명)을 **이 엔진이 읽을 수 있는 검색어**로 바꿉니다.
 *
 * ⚠️ **괄호·`+`·`&`·`/`·`!`·`:` 를 그대로 넘기면 안 됩니다.** 전부 질의 문법의 글자라,
 * `미적분학2(EC)` 를 그대로 던지면 `(EC)` 가 논리식의 **괄호 그룹**으로 파싱되고
 * `Cognitive Neuroscience: The…` 는 `:` 앞이 prefix 로 잘립니다.
 *
 * 괄호는 **지우고 안의 글자는 남깁니다** — `fuzzyMatch` 의 `normalize()` 가 검색 대상
 * 에서도 구두점을 떼기 때문에, `미적분학2EC` 는 `미적분학2(EC)` 에만 붙고 한국어반
 * `미적분학2` 에는 안 붙습니다. 통째로 잘라 내면 그 구분이 사라집니다.
 */
export const toSearchTerm = (value: string): string =>
    value
        .replace(/[()+&/!:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/** 과목 하나. 영문 병기는 떼고 검색 문법 글자만 털어 냅니다 */
export const subjectQuery = (subject: string): string =>
    toSearchTerm(getKoreanName(subject) || subject);

/**
 * 과목의 한 분반 — 이 엔진의 **구분자 검색**(`국어1/1`) 형식입니다.
 * `section` 은 `제5분반`·`05` 처럼 들어오므로 숫자만 뽑습니다.
 */
export const sectionQuery = (subject: string, section: string): string => {
    const number = section.replace(/[^0-9]/g, "");
    const name = subjectQuery(subject);
    return number ? `${name}/${number}` : name;
};

/** 교사 전용 모드 — 이름이 과목·교실과 겹쳐도 사람만 나옵니다 */
export const teacherQuery = (teacher: string): string =>
    `teacher:${toSearchTerm(teacher)}`;

/** 검색 화면 주소. `App` 이 `?q=` 를 읽어 검색어로 넣습니다 */
export const searchHref = (query: string): string =>
    `/search?q=${encodeURIComponent(query)}`;
