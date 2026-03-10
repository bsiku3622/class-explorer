/**
 * 논리식 평가 함수: +, &, &&, () 연산자를 지원합니다.
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
            .match(/\(|\)|&&|&|\+|[^\(\)+&]+/g)
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
        !["(", ")", "+", "&", "&&"].includes(tokens[0])
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
        let result = parseFactor();
        while (
            current < tokens.length &&
            (tokens[current] === "&" || tokens[current] === "&&")
        ) {
            current++;
            const next = parseFactor();
            result = result && next;
        }
        return result;
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
    mode: "general" | "student" | "teacher";
    warning?: string;
    stats: {
        keyword: string;
        total_subjects: number;
        total_sections: number;
    };
}

const parseQuery = (searchTerm: string) => {
    let cleanKeyword = searchTerm.trim();
    let mode: "general" | "student" | "teacher" = "general";
    let effectiveQuery = cleanKeyword;
    let warning: string | undefined = undefined;

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
        }

        if (mode !== "general") {
            const hasLogic =
                effectiveQuery.includes("&") ||
                effectiveQuery.includes("+") ||
                effectiveQuery.includes("(") ||
                effectiveQuery.includes(")");
            if (hasLogic) {
                warning =
                    "인물 검색 모드(student:, teacher:)에서는 논리 연산(&, +, 괄호)을 지원하지 않습니다. 키워드가 리터럴로 처리됩니다.";
                // 논리 연산이 포함된 경우, 이 모드에서는 전체를 하나의 검색어로 취급 (literal)
            }
        }
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
        // 논리 연산 경고가 있는 경우 (인물 모드에서 논리 연산자 사용)
        // 전체를 하나의 검색어로 취급
        flatTerms = [matchBase.toLowerCase()];
    } else {
        flatTerms = matchBase
            .split(/[+&()\/]+/)
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
        isStrictMode: searchTerm.includes("&&") || personExpr !== null,
    };
};

/**
 * 전체 데이터에서 검색 조건에 맞는 분반들을 필터링합니다.
 * selectedYears를 반영하여 제외된 학번의 학생은 데이터 풀에서 제외합니다.
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
        const subjectPersonPool = new Set<string>();

        // 1. 과목 레벨 인물 풀 구성 (선택된 학번의 학생만 포함)
        subject.sections.forEach((sec: any) => {
            subjectPersonPool.add(sec.teacher);
            sec.students.forEach((s: any) => {
                const year = s.stuId.split("-")[0];
                if (selectedYears.includes(year)) {
                    subjectPersonPool.add(s.stuId);
                    subjectPersonPool.add(s.name);
                }
            });
        });

        // 논리 검색 지원 여부에 따라 평가 방식 변경
        const evaluate = (expr: string, pool: string[]) => {
            if (warning && expr === effectiveQuery) {
                // 인물 모드에서 논리 연산자가 사용된 경우 -> 리터럴 매칭
                return pool.some((item) => item.toLowerCase().includes(expr.toLowerCase()));
            }
            return evaluateBoolExpression(expr, pool, mode === "student");
        };

        const isSubjectMatch = personExpr
            ? evaluate(subjectExpr, [subjectName]) &&
              evaluate(personExpr, Array.from(subjectPersonPool))
            : evaluate(effectiveQuery, [
                  subjectName,
                  ...Array.from(subjectPersonPool),
              ]);

        if (!isSubjectMatch) return;

        // 2. 분반 레벨 필터링
        subject.sections.forEach((sec: any) => {
            // 필터링된 학생 목록 생성
            const activeStudents = sec.students.filter((s: any) =>
                selectedYears.includes(s.stuId.split("-")[0]),
            );

            // 인물 풀 구성 (선택된 학번의 학생만 포함)
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
            ];

            let isSectionMatch = false;

            if (personExpr !== null) {
                // / 가 있는 경우: 과목 조건 AND 인물 조건
                const sM = evaluate(subjectExpr, sectionInfoPool);
                const pM = evaluate(personExpr, sectionPersonPool);
                isSectionMatch = sM && pM;
            } else if (mode === "student") {
                // student: 인 경우: 해당 인물이 이 분반에 있는지 확인
                isSectionMatch = evaluate(effectiveQuery, sectionPersonPool);
            } else if (mode === "teacher") {
                // teacher: 인 경우: 해당 교사의 분반인지 확인
                isSectionMatch = evaluate(effectiveQuery, [sec.teacher]);
            } else if (isStrictMode) {
                // && 연산자가 포함된 일반 검색
                isSectionMatch = evaluate(effectiveQuery, [
                    ...sectionInfoPool,
                    ...sectionPersonPool,
                ]);
            } else {
                // 일반 Soft mode 검색 (mode === "general")
                if (flatTerms.length === 0) {
                    isSectionMatch = activeStudents.length > 0;
                } else {
                    const isInfoMatch = evaluate(effectiveQuery, sectionInfoPool);
                    const isPersonMatch = flatTerms.some((term) =>
                        sectionPersonPool.some((p) =>
                            p.toLowerCase().includes(term),
                        ),
                    );
                    isSectionMatch = isInfoMatch || isPersonMatch;
                }
            }

            // 최종 표시 여부 결정
            if (isSectionMatch) {
                // 교사 검색이 아니고 표시할 학생이 한 명도 없으면 제외
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
    _: string[],
) => {
    const entityMap = new Map<string, any>();

    matchingClasses.forEach((cls) => {
        if (flatTerms.some((t) => cls.teacher.toLowerCase().includes(t))) {
            const key = `t_${cls.teacher}`;
            if (!entityMap.has(key)) {
                entityMap.set(key, {
                    type: "teacher",
                    name: cls.teacher,
                    id: "Teacher",
                    subjects: new Set(),
                });
            }
            entityMap.get(key).subjects.add(cls.subject);
        }

        cls.students.forEach((s: any) => {
            if (
                flatTerms.some(
                    (t) =>
                        s.stuId.toLowerCase().includes(t) ||
                        s.name.toLowerCase().includes(t),
                )
            ) {
                if (!entityMap.has(s.stuId)) {
                    entityMap.set(s.stuId, {
                        type: "student",
                        name: s.name,
                        id: s.stuId,
                        subjects: new Set(),
                    });
                }
                entityMap.get(s.stuId).subjects.add(cls.subject);
            }
        });
    });

    return Array.from(entityMap.values()).map((e) => ({
        ...e,
        subject_count: e.subjects.size,
        subjects: Array.from(e.subjects).sort() as string[],
    }));
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
        selectedYears,
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

    return {
        data: finalData,
        entities,
        mode: queryParams.mode,
        warning: queryParams.warning,
        stats: {
            keyword: queryParams.effectiveQuery,
            total_subjects: finalData.length,
            total_sections: matchingClasses.length,
        },
    };
};
