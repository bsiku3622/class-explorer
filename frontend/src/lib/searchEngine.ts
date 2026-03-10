import { formatSubjectWithSection } from "./utils";

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

    const matchesItem = (item: string, term: string) => {
        const lowerItem = item.toLowerCase();
        const lowerTerm = term.toLowerCase();

        // 학번 검색 (strictIDMatch인 경우)
        if (strictIDMatch && item.includes("-") && term.includes("-")) {
            // "24-" 처럼 3글자 이내인 경우만 prefix match 허용 (batch 검색용)
            if (term.length <= 3) return lowerItem.startsWith(lowerTerm);
            // 그 외에는 정확히 일치해야 함 (24-09가 24-094를 매칭하지 않도록)
            return lowerItem === lowerTerm;
        }

        return lowerItem.includes(lowerTerm);
    };

    if (
        tokens.length === 1 &&
        !["(", ")", "+", "&", "&&", "!"].includes(tokens[0])
    ) {
        const term = tokens[0];
        return pool.some((item) => matchesItem(item, term));
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
        return pool.some((item) => matchesItem(item, term));
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

const parseQuery = (searchTerm: string, allData: any[]) => {
    let cleanKeyword = searchTerm.trim();
    let mode: "general" | "student" | "teacher" | "room" = "general";
    let effectiveQuery = cleanKeyword;
    let warning: string | undefined = undefined;

    // 모든 강의실 목록 수집
    const allRooms = new Set<string>();
    allData.forEach((sub) =>
        sub.sections.forEach((sec: any) => {
            if (sec.room) allRooms.add(sec.room);
        }),
    );

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
                    "인물/강의실 검색 모드에서는 논리 연산(&, +, 괄호)을 지원하지 않습니다. 키워드가 리터럴로 처리됩니다.";
            }
        }
    } else {
        // 프리픽스 없을 때 강의실 자동 감지 제거 (사용자 요청: 결과 카드를 먼저 보여주기 위해)
        // mode = "general"로 유지
    }

    let subjectExpr = effectiveQuery;
    let personExpr: string | null = null;
    if (effectiveQuery.includes("/")) {
        const [s, p] = effectiveQuery.split("/");
        subjectExpr = s.trim();
        personExpr = p.trim();
    }

    const matchBase = personExpr || effectiveQuery;
    let flatTerms: string[] = [];
    if (warning) {
        flatTerms = [matchBase.toLowerCase()];
    } else {
        flatTerms = matchBase
            .split(/[+&()\/!]+/)
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t);
    }

    return {
        mode,
        effectiveQuery,
        subjectExpr,
        personExpr,
        flatTerms,
        warning,
        isStrictMode:
            searchTerm.includes("&&") || personExpr !== null || mode === "room",
    };
};

/**
 * 전체 데이터에서 검색 조건에 맞는 분반들을 필터링합니다.
 */
const filterMatchingClasses = (
    allData: any[],
    queryParams: ReturnType<typeof parseQuery>,
    selectedYears: string[],
) => {
    const {
        mode,
        effectiveQuery,
        subjectExpr,
        personExpr,
        isStrictMode,
        flatTerms,
        warning,
    } = queryParams;
    const matchingClasses: any[] = [];

    allData.forEach((subject) => {
        const subjectName = subject.subject;
        const subjectMatchPool = new Set<string>();
        const dayMap: Record<string, string> = {
            MON: "월",
            TUE: "화",
            WED: "수",
            THU: "목",
            FRI: "금",
        };

        // 1. 과목 레벨 검색 풀 구성
        subjectMatchPool.add(subjectName);
        subject.sections.forEach((sec: any) => {
            subjectMatchPool.add(sec.teacher);
            if (sec.room) subjectMatchPool.add(sec.room);
            if (sec.times) {
                sec.times.forEach((t: any) => {
                    if (t.room) subjectMatchPool.add(t.room);
                    subjectMatchPool.add(`${t.day}${t.period}`);
                    subjectMatchPool.add(`${dayMap[t.day]}${t.period}`);
                });
            }
            sec.students.forEach((s: any) => {
                const year = s.stuId.split("-")[0];
                if (selectedYears.includes(year)) {
                    subjectMatchPool.add(s.stuId);
                    subjectMatchPool.add(s.name);
                }
            });
        });

        const evaluate = (expr: string, pool: string[]) => {
            if (warning && expr === effectiveQuery) {
                return pool.some((item) =>
                    item.toLowerCase().includes(expr.toLowerCase()),
                );
            }
            return evaluateBoolExpression(expr, pool, mode === "student");
        };

        const isSubjectMatch = personExpr
            ? evaluate(subjectExpr, [subjectName]) &&
              evaluate(personExpr, Array.from(subjectMatchPool))
            : evaluate(effectiveQuery, Array.from(subjectMatchPool));

        if (!isSubjectMatch) return;

        // 2. 분반 레벨 필터링
        subject.sections.forEach((sec: any) => {
            const activeStudents = sec.students.filter((s: any) =>
                selectedYears.includes(s.stuId.split("-")[0]),
            );

            const sectionPersonPool = [
                sec.teacher,
                ...activeStudents.map((s: any) => s.stuId),
                ...activeStudents.map((s: any) => s.name),
            ];
            const sectionInfoPool = [
                subjectName,
                sec.section,
                sec.teacher,
                sec.room,
                ...(sec.times || []).flatMap((t: any) => [
                    t.room,
                    `${t.day}${t.period}`,
                    `${dayMap[t.day]}${t.period}`,
                ]),
            ];

            let isSectionMatch = false;

            if (personExpr !== null) {
                const sM = evaluate(subjectExpr, sectionInfoPool);
                const pM = evaluate(personExpr, sectionPersonPool);
                isSectionMatch = sM && pM;
            } else if (mode === "student") {
                isSectionMatch = evaluate(effectiveQuery, sectionPersonPool);
            } else if (mode === "teacher") {
                isSectionMatch = evaluate(effectiveQuery, [sec.teacher]);
            } else if (mode === "room") {
                const searchRoom = effectiveQuery.toLowerCase();
                const primaryRoomMatch = sec.room
                    .toLowerCase()
                    .includes(searchRoom);
                const timesRoomMatch = (sec.times || []).some((t: any) =>
                    t.room.toLowerCase().includes(searchRoom),
                );
                isSectionMatch = primaryRoomMatch || timesRoomMatch;
            } else if (isStrictMode) {
                isSectionMatch = evaluate(effectiveQuery, [
                    ...sectionInfoPool,
                    ...sectionPersonPool,
                ]);
            } else {
                if (flatTerms.length === 0) {
                    isSectionMatch = activeStudents.length > 0;
                } else {
                    const isInfoMatch = evaluate(
                        effectiveQuery,
                        sectionInfoPool,
                    );
                    const isPersonMatch = flatTerms.some((term) =>
                        sectionPersonPool.some((p) =>
                            p.toLowerCase().includes(term),
                        ),
                    );
                    isSectionMatch = isInfoMatch || isPersonMatch;
                }
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

/**
 * 매칭된 분반들로부터 관련 엔티티(사람, 강의실 등)를 추출합니다.
 */
const extractEntities = (
    matchingClasses: any[],
    flatTerms: string[],
    mode: "general" | "student" | "teacher" | "room",
    effectiveQuery: string,
) => {
    const entityMap = new Map<string, any>();
    const dayMap: Record<string, string> = {
        MON: "월",
        TUE: "화",
        WED: "수",
        THU: "목",
        FRI: "금",
    };

    matchingClasses.forEach((cls) => {
        // 강의실 정보 수집
        const searchRoom = effectiveQuery.toLowerCase();
        const matchingRooms = new Set<string>();
        
        if (cls.room.toLowerCase().includes(searchRoom)) {
            matchingRooms.add(cls.room);
        }
        (cls.times || []).forEach((t: any) => {
            if (t.room.toLowerCase().includes(searchRoom)) {
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
                        subjectsRaw: new Map<string, Set<string>>(), // "teacher - subject" -> Set(sections)
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
                        // 해당 강의실에서 진행되는 수업만 추가
                        if (t.room.toLowerCase().includes(searchRoom)) {
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
                cls.teacher.toLowerCase().includes(t) ||
                classTimeStrings.includes(t.toLowerCase()),
        );

        if (isTeacherMatch) {
            const key = `t_${cls.teacher}`;
            if (!entityMap.has(key)) {
                entityMap.set(key, {
                    type: "teacher",
                    name: cls.teacher,
                    id: "Teacher",
                    subjectsRaw: new Map<string, Set<string>>(), // "room - subject" -> Set(sections)
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
                    s.stuId.toLowerCase().includes(t) ||
                    s.name.toLowerCase().includes(t) ||
                    classTimeStrings.includes(t.toLowerCase()),
            );

            if (isStudentMatch) {
                if (!entityMap.has(s.stuId)) {
                    entityMap.set(s.stuId, {
                        type: "student",
                        name: s.name,
                        id: s.stuId,
                        subjectsRaw: new Map<string, Set<string>>(), // "teacher - subject" -> Set(sections)
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
            
            // 학생/선생님 프로필: 과목(분반) - 추가정보
            // 교실 프로필: 선생님 - 과목(분반)
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
