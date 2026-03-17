import { formatSubjectWithSection, DAY_MAP as dayMap, replaceRomanNumerals } from "./utils";

/**
 * 한글 문자열에서 초성을 추출합니다.
 */
export const getChosung = (str: string): string => {
    const cho = [
        "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
    ];
    let result = "";
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i) - 44032;
        if (code > -1 && code < 11172) {
            result += cho[Math.floor(code / 588)];
        } else {
            result += str.charAt(i);
        }
    }
    return result;
};

/**
 * 초성 검색을 포함한 문자열 매칭 함수
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

    return false;
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
            .match(/\(|\)|&&|&|\+|!|[^\(\)+&!]+/g)
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
    } catch (e) {
        return false;
    }
};

export interface SearchResult {
    data: any[];
    entities: any[];
    mode: "general" | "student" | "teacher" | "room";
    warning?: string;
    stats: {
        keyword: string;
        total_subjects: number;
        total_sections: number;
        total_matched_students: number;
    };
}

const parseQuery = (searchTerm: string, _allData: any[]) => {
    let cleanKeyword = searchTerm.trim();
    let mode: "general" | "student" | "teacher" | "room" = "general";
    let effectiveQuery = cleanKeyword;
    let warning: string | undefined = undefined;

    // '국어1/1' 같은 과목/분반 패턴 확인 (문자열/숫자 형식)
    const isDividerSearch = /.+\/\d+$/.test(cleanKeyword);

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
    allData: any[],
    queryParams: ReturnType<typeof parseQuery>,
    selectedYears: string[],
) => {
    const {
        mode,
        effectiveQuery,
        flatTerms: _flatTerms,
        warning,
        isDividerSearch,
    } = queryParams;
    const matchingClasses: any[] = [];

    // '국어1/1' 패턴에서 과목과 분반 분리
    let targetSubject = "", targetSection = "";
    if (isDividerSearch) {
        const lastSlashIndex = effectiveQuery.lastIndexOf("/");
        targetSubject = effectiveQuery.substring(0, lastSlashIndex).toLowerCase();
        targetSection = effectiveQuery.substring(lastSlashIndex + 1);
    }

    allData.forEach((subject) => {
        const subjectName = subject.subject;
        subject.sections.forEach((sec: any) => {
            const activeStudents = sec.students.filter((s: any) =>
                selectedYears.includes(s.stuId.split("-")[0]),
            );

            const sectionPool = [
                subjectName,
                replaceRomanNumerals(subjectName),
                ...(subject.aliases || []),
                sec.section,
                sec.teacher,
                sec.room,
                ...(sec.times || []).flatMap((t: any) => [
                    t.room,
                    `${t.day}${t.period}`,
                    `${dayMap[t.day]}${t.period}`,
                ]),
                ...activeStudents.map((s: any) => s.stuId),
                ...activeStudents.map((s: any) => s.name),
            ].filter(Boolean);

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
                const lowerSubject = subjectName.toLowerCase();
                const sectionNum = sec.section.replace(/[^0-9]/g, "");
                isSectionMatch = lowerSubject.includes(targetSubject) && sectionNum === targetSection;
            } else if (mode === "student") {
                isSectionMatch = evaluate(effectiveQuery, [
                    ...activeStudents.map((s: any) => s.stuId),
                    ...activeStudents.map((s: any) => s.name),
                ]);
            } else if (mode === "teacher") {
                isSectionMatch = evaluate(effectiveQuery, [sec.teacher]);
            } else if (mode === "room") {
                const searchRoom = effectiveQuery.toLowerCase();
                isSectionMatch = [sec.room, ...(sec.times || []).map((t: any) => t.room)]
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
                    students: activeStudents,
                    student_count: activeStudents.length,
                });
            }
        });
    });

    return matchingClasses;
};

const extractEntities = (
    matchingClasses: any[],
    flatTerms: string[],
    mode: "general" | "student" | "teacher" | "room",
    effectiveQuery: string,
) => {
    const entityMap = new Map<string, any>();

    matchingClasses.forEach((cls) => {
        const searchRoom = effectiveQuery.toLowerCase();
        const matchingRooms = new Set<string>();
        
        if (matchesItem(cls.room, searchRoom)) {
            matchingRooms.add(cls.room);
        }
        (cls.times || []).forEach((t: any) => {
            if (matchesItem(t.room, searchRoom)) {
                matchingRooms.add(t.room);
            }
        });

        if (mode === "room" || (mode === "general" && matchingRooms.size > 0)) {
            matchingRooms.forEach(roomName => {
                const key = `room_${roomName}`;
                if (!entityMap.has(key)) {
                    entityMap.set(key, {
                        type: "room",
                        name: roomName,
                        id: "Classroom",
                        subjectsRaw: new Map<string, Set<string>>(),
                        times: [],
                    });
                }
                const roomEntity = entityMap.get(key);
                const subKey = `${cls.teacher}|${cls.subject}`;
                if (!roomEntity.subjectsRaw.has(subKey)) {
                    roomEntity.subjectsRaw.set(subKey, new Set());
                }
                roomEntity.subjectsRaw.get(subKey).add(cls.section);

                if (cls.times) {
                    cls.times.forEach((t: any) => {
                        if (matchesItem(t.room, searchRoom)) {
                            if (!roomEntity.times.some((et: any) => et.day === t.day && et.period === t.period)) {
                                roomEntity.times.push({ 
                                    ...t, 
                                    subject: cls.subject,
                                    section: cls.section,
                                    teacher: cls.teacher
                                });
                            }
                        }
                    });
                }
            });
        }

        const classTimeStrings = (cls.times || []).flatMap((t: any) => [
            `${t.day}${t.period}`.toLowerCase(),
            `${dayMap[t.day]}${t.period}`.toLowerCase(),
        ]);

        const isTeacherMatch = flatTerms.some(
            (t) =>
                matchesItem(cls.teacher, t) ||
                classTimeStrings.includes(t.toLowerCase()),
        );

        if (isTeacherMatch) {
            const key = `t_${cls.teacher}`;
            if (!entityMap.has(key)) {
                entityMap.set(key, {
                    type: "teacher",
                    name: cls.teacher,
                    id: "Teacher",
                    subjectsRaw: new Map<string, Set<string>>(),
                    times: [],
                });
            }
            const entity = entityMap.get(key);
            const subKey = `${cls.room}|${cls.subject}`;
            if (!entity.subjectsRaw.has(subKey)) {
                entity.subjectsRaw.set(subKey, new Set());
            }
            entity.subjectsRaw.get(subKey).add(cls.section);

            if (cls.times) {
                cls.times.forEach((t: any) => {
                    if (
                        !entity.times.some(
                            (et: any) =>
                                et.day === t.day && et.period === t.period,
                        )
                    ) {
                        entity.times.push({ 
                            ...t, 
                            subject: cls.subject,
                            section: cls.section,
                            teacher: cls.teacher
                        });
                    }
                });
            }
        }

        cls.students.forEach((s: any) => {
            const isStudentMatch = flatTerms.some(
                (t) =>
                    matchesItem(s.stuId, t) ||
                    matchesItem(s.name, t) ||
                    classTimeStrings.includes(t.toLowerCase()),
            );

            if (isStudentMatch) {
                if (!entityMap.has(s.stuId)) {
                    entityMap.set(s.stuId, {
                        type: "student",
                        name: s.name,
                        id: s.stuId,
                        subjectsRaw: new Map<string, Set<string>>(),
                        times: [],
                    });
                }
                const entity = entityMap.get(s.stuId);
                const subKey = `${cls.teacher}|${cls.subject}`;
                if (!entity.subjectsRaw.has(subKey)) {
                    entity.subjectsRaw.set(subKey, new Set());
                }
                entity.subjectsRaw.get(subKey).add(cls.section);

                if (cls.times) {
                    cls.times.forEach((t: any) => {
                        if (
                            !entity.times.some(
                                (et: any) =>
                                    et.day === t.day && et.period === t.period,
                            )
                        ) {
                            entity.times.push({ 
                                ...t, 
                                subject: cls.subject,
                                section: cls.section,
                                teacher: cls.teacher
                            });
                        }
                    });
                }
            }
        });
    });

    return Array.from(entityMap.values()).map((e) => {
        const formattedSubjects: string[] = [];
        e.subjectsRaw.forEach((sections: Set<string>, key: string) => {
            const [extra, subject] = key.split("|");
            const position = e.type === "room" ? "prefix" : "suffix";
            formattedSubjects.push(
                formatSubjectWithSection(subject, Array.from(sections), extra, position)
            );
        });

        return {
            ...e,
            subject_count: formattedSubjects.length,
            subjects: formattedSubjects.sort(),
        };
    }).sort((a, b) => {
        const priority: Record<string, number> = { teacher: 1, student: 2, room: 3 };
        if (priority[a.type] !== priority[b.type]) {
            return priority[a.type] - priority[b.type];
        }
        if (a.type === "teacher" || a.type === "room") {
            return a.name.localeCompare(b.name, "ko");
        } else {
            return a.id.localeCompare(b.id);
        }
    });
};

export const searchInClient = (
    allData: any[],
    searchTerm: string,
    selectedYears: string[],
): SearchResult => {
    if (!searchTerm.trim()) {
        const filteredData = allData
            .map((subject) => ({
                ...subject,
                sections: subject.sections
                    .filter((sec: any) =>
                        sec.students.some((s: any) =>
                            selectedYears.includes(s.stuId.split("-")[0]),
                        ),
                    )
                    .map((sec: any) => ({
                        ...sec,
                        students: sec.students.filter((s: any) =>
                            selectedYears.includes(s.stuId.split("-")[0]),
                        ),
                    })),
            }))
            .filter((subject) => subject.sections.length > 0);

        const totalMatchedStudents = new Set(
            filteredData.flatMap((sub) =>
                sub.sections.flatMap((sec: any) => sec.students.map((s: any) => s.stuId)),
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

    const queryParams = parseQuery(searchTerm, allData);
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

    const grouped: Record<string, any[]> = {};
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
                secs.flatMap((s) => s.students.map((st: any) => st.stuId)),
            );
            return {
                subject: sub,
                subject_student_count: subStus.size,
                section_count: secs.length,
                sections: secs,
            };
        });

    const totalMatchedStudents = new Set(
        matchingClasses.flatMap((cls) => cls.students.map((s: any) => s.stuId))
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
