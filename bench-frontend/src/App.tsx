import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import axios from "axios";
import api from "./lib/api";
import {
    useLocation,
    useNavigate,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import type {
    SubjectData,
    Stats,
    SearchResultStats,
    StudentTimetable,
    Term,
    Role,
} from "./types";
import { hasRole } from "./lib/utils";
import { searchInClient } from "./lib/searchEngine";
import { isTradeAvailable } from "./lib/features";
import {
    searchStudents,
    fetchStudentTimetable,
    type StudentSearchResponse,
} from "./lib/benchApi";
import { useModifierKey } from "./hooks/useModifierKey";
import Navigation from "./components/Navigation";
import Sidebar from "./components/Sidebar";
import BottomNav from "./components/BottomNav";
import GoogleLinkModal from "./components/GoogleLinkModal";

// Pages (lazy loaded for code splitting)
const SearchPage = React.lazy(() => import("./pages/SearchPage"));
const RoomsPage = React.lazy(() => import("./pages/RoomsPage"));
const AnalysisPage = React.lazy(() => import("./pages/AnalysisPage"));
const BrowsePage = React.lazy(() => import("./pages/BrowsePage"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const LoginPage = React.lazy(() => import("./pages/LoginPage"));
const TradePage = React.lazy(() => import("./pages/TradePage"));
const FriendsPage = React.lazy(() => import("./pages/FriendsPage"));
const ZamongPage = React.lazy(() => import("./pages/ZamongPage"));
const CalendarPage = React.lazy(() => import("./pages/CalendarPage"));

const SESSION_TOKEN_KEY = "ksa_session_token";
const CACHE_PREFIX = "ksa_class_finder_cache";
/**
 * 캐시된 응답의 스키마 버전. API 응답에 필드가 늘면 올려야 합니다.
 * 안 올리면 예전 응답을 든 브라우저가 최대 1시간 동안 새 필드를 못 받아
 * 학점이 0으로 보이는 식의 문제가 생깁니다.
 *
 * **4 = 분반 명단(`students`)이 빠진 응답.** 여기서 올리지 않으면 class-explorer 를
 * 쓰던 브라우저에 명단이 든 옛 캐시가 최대 1시간 남습니다.
 * **5 = 학번 분포(`year_counts` / `subject_year_counts`) 추가.**
 * **6 = 분반 명단(`students`) 복구** — Trade 가 명단 없이는 안 됩니다.
 */
const CACHE_VERSION = 6;
const TERM_KEY = "ksa_selected_term";
const CACHE_EXPIRY = 60 * 60 * 1000;

/** 데이터 캐시는 학기별로 분리 보관 */
const cacheKeyFor = (term: Term) => `${CACHE_PREFIX}_${term.year}_${term.semester}`;

const clearDataCache = () => {
    Object.keys(localStorage)
        .filter((key) => key.startsWith(CACHE_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
};

const loadSavedTerm = (): Term | null => {
    try {
        const raw = localStorage.getItem(TERM_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed?.year === "number" && typeof parsed?.semester === "number"
            ? { year: parsed.year, semester: parsed.semester }
            : null;
    } catch {
        return null;
    }
};

const App: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const [sessionToken, setSessionToken] = useState<string | null>(
        () => localStorage.getItem(SESSION_TOKEN_KEY),
    );
    const [currentUser, setCurrentUser] = useState<{
        id: number;
        username: string;
        /** user < manager < admin — 위계라서 admin 은 manager 가 하는 일도 다 합니다 */
        role: Role;
        /** 계정에 등록된 본인 학번 — 등록 전에는 null */
        stu_id: string | null;
        student_name: string | null;
        /** 학교 구글 계정. 옛 계정은 비어 있고, 연결하기 전에는 앱을 쓸 수 없습니다 */
        email: string | null;
    } | null>(null);

    const initialSearch = useMemo(
        () =>
            location.pathname === "/"
                ? new URLSearchParams(location.search).get("q") || ""
                : "",
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const [allClassesData, setAllClassesData] = useState<SubjectData[]>([]);
    const [displayData, setDisplayData] = useState<SubjectData[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [studentCounts, setStudentCounts] = useState<Record<string, number>>(
        {},
    );
    /** 서버가 세어 준 학기 집계. 명단이 없으니 프론트에서 다시 셀 수 없습니다 */
    const [termStats, setTermStats] = useState<Stats | null>(null);
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [searchInput, setSearchInput] = useState(initialSearch);
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
    const [searchResult, setSearchResult] = useState<SearchResultStats | null>(
        null,
    );
    const [searchMode, setSearchMode] = useState<"general" | "teacher" | "room">(
        "general",
    );
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
    const [term, setTerm] = useState<Term | null>(loadSavedTerm);
    const [availableTerms, setAvailableTerms] = useState<Term[]>([]);

    // ─── 사람 찾기 ───────────────────────────────────────────────────────────
    // 학생은 클라이언트가 훑지 않고 서버에 물어봅니다. 두 단계인 이유는, 한 번의
    // 질의로 여러 명의 시간표가 한꺼번에 나오면 다중 검색을 없앤 의미가 없어서입니다.
    //   1단계 `student:김민` → 후보 목록 (이름·학번만)
    //   2단계 후보를 고르면  → 그 한 명의 시간표
    const [studentSearch, setStudentSearch] = useState<StudentSearchResponse | null>(
        null,
    );
    const [studentTimetable, setStudentTimetable] = useState<StudentTimetable | null>(
        null,
    );
    const [studentLoading, setStudentLoading] = useState(false);
    const [studentError, setStudentError] = useState<string | null>(null);

    const isModifierPressed = useModifierKey();
    const tradeAvailable = isTradeAvailable(term);

    const handleLogout = useCallback(async () => {
        const token = localStorage.getItem(SESSION_TOKEN_KEY);
        if (token) {
            try {
                await api.post(
                    "/auth/logout",
                    {},
                    { headers: { Authorization: `Bearer ${token}` } },
                );
            } catch (_) {
                // 서버 오류여도 로컬 세션은 정리
            }
        }
        localStorage.removeItem(SESSION_TOKEN_KEY);
        clearDataCache();
        setSessionToken(null);
        setCurrentUser(null);
        setAllClassesData([]);
        setDisplayData([]);
        setStats(null);
    }, []);

    const handleLogin = useCallback((token: string) => {
        localStorage.setItem(SESSION_TOKEN_KEY, token);
        setSessionToken(token);
    }, []);

    useEffect(() => {
        if (location.pathname === "/") {
            const q = new URLSearchParams(location.search).get("q") || "";
            if (q !== searchInput) {
                setSearchInput(q);
                setSearchTerm(q);
            }
        }
    }, [location.pathname]);

    /** `student:김민` 이면 `"김민"`, 아니면 null — 사람 찾기 화면으로 갈지 정합니다 */
    const studentQuery = useMemo(() => {
        const matched = searchTerm.trim().match(/^(?:s|st|student)\s*:\s*(.*)$/i);
        return matched ? matched[1].trim() : null;
    }, [searchTerm]);

    const isConsolidatedView = useMemo(
        () => searchMode !== "general",
        [searchMode],
    );

    const teacherSubjectMap = useMemo(() => {
        const map: Record<string, Record<string, string[]>> = {};
        allClassesData.forEach((item) => {
            item.sections.forEach((section) => {
                if (!map[section.teacher]) map[section.teacher] = {};
                if (!map[section.teacher][item.subject])
                    map[section.teacher][item.subject] = [];
                if (
                    !map[section.teacher][item.subject].includes(
                        section.section,
                    )
                ) {
                    map[section.teacher][item.subject].push(section.section);
                }
            });
        });
        return map;
    }, [allClassesData]);

    const fetchInitialData = async (force: boolean = false, targetTerm?: Term) => {
        const token = localStorage.getItem(SESSION_TOKEN_KEY);
        if (!token) return;
        // 학기 미지정(최초 진입)이면 서버가 최신 학기를 골라 응답합니다
        const requestedTerm = targetTerm ?? term;
        try {
            setLoading(true);
            const cached =
                !force && requestedTerm
                    ? localStorage.getItem(cacheKeyFor(requestedTerm))
                    : null;
            if (cached) {
                const { v, timestamp, student_counts, stats, data, available_terms } =
                    JSON.parse(cached);
                if (v === CACHE_VERSION && Date.now() - timestamp < CACHE_EXPIRY) {
                    setStudentCounts(student_counts);
                    setSelectedYears(Object.keys(student_counts));
                    setTermStats(stats ?? null);
                    setAllClassesData(data);
                    if (available_terms) setAvailableTerms(available_terms);
                    setLastUpdated(timestamp);
                    setLoading(false);
                    return;
                }
            }
            const response = await api.get("/", {
                headers: { Authorization: `Bearer ${token}` },
                params: requestedTerm
                    ? { year: requestedTerm.year, semester: requestedTerm.semester }
                    : undefined,
            });
            const {
                student_counts,
                stats: apiStats,
                data,
                term: resolvedTerm,
                available_terms,
            } = response.data;
            const now = Date.now();
            if (resolvedTerm) {
                localStorage.setItem(
                    cacheKeyFor(resolvedTerm),
                    JSON.stringify({
                        v: CACHE_VERSION,
                        timestamp: now,
                        student_counts,
                        stats: apiStats,
                        data,
                        available_terms,
                    }),
                );
                localStorage.setItem(TERM_KEY, JSON.stringify(resolvedTerm));
                setTerm(resolvedTerm);
            }
            if (available_terms) setAvailableTerms(available_terms);
            setStudentCounts(student_counts);
            setSelectedYears(Object.keys(student_counts));
            setTermStats(apiStats ?? null);
            setAllClassesData(data);
            setLastUpdated(now);
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                handleLogout();
                return;
            }
            console.error("Error fetching initial data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTermChange = useCallback(
        (next: Term) => {
            if (term?.year === next.year && term?.semester === next.semester) return;
            setTerm(next);
            localStorage.setItem(TERM_KEY, JSON.stringify(next));
            fetchInitialData(false, next);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [term],
    );

    /**
     * 학년 필터. 예전에는 분반 명단을 뒤져 학번을 봤지만, 이제는 서버가 주는
     * `year_counts`(이름 없는 숫자)만으로 같은 일을 합니다.
     */
    const filterByYears = useCallback(
        (subjects: SubjectData[]) => {
            if (selectedYears.length === 0) return subjects;
            return subjects
                .map((subject) => ({
                    ...subject,
                    sections: subject.sections.filter((section) =>
                        selectedYears.some(
                            (year) => (section.year_counts?.[year] ?? 0) > 0,
                        ),
                    ),
                }))
                .filter((subject) => subject.sections.length > 0);
        },
        [selectedYears],
    );

    const handleSearch = useCallback(() => {
        if (allClassesData.length === 0 || location.pathname !== "/") return;

        // 사람 찾기는 서버가 합니다 — 아래 effect 가 맡고, 여기서는 비워 둡니다
        if (studentQuery !== null) {
            setDisplayData([]);
            setStats(null);
            setSearchResult(null);
            setSearchMode("general");
            return;
        }

        if (searchTerm.trim()) {
            const result = searchInClient(allClassesData, searchTerm);
            const filtered = filterByYears(result.data);
            setDisplayData(filtered);
            setSearchMode(result.mode);
            setSearchResult({
                keyword: result.stats.keyword || searchTerm,
                prefix: result.mode !== "general" ? result.mode : "",
                entities: result.entities,
                total_subjects: filtered.length,
                total_sections: filtered.reduce(
                    (sum, s) => sum + s.sections.length,
                    0,
                ),
            });
            setStats(null);
        } else {
            setSearchMode("general");
            const filtered = filterByYears(allClassesData);
            setDisplayData(filtered);
            // 수강 인원은 서버가 세어 준 값을 씁니다 — 명단이 없으니 여기서 셀 수 없습니다
            setStats(termStats);
            setSearchResult(null);
        }
    }, [
        searchTerm,
        studentQuery,
        allClassesData,
        termStats,
        filterByYears,
        location.pathname,
    ]);

    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    const loadStudentTimetable = useCallback(
        async (stuId: string) => {
            setStudentLoading(true);
            setStudentError(null);
            try {
                setStudentTimetable(await fetchStudentTimetable(stuId, term));
            } catch (error: unknown) {
                setStudentTimetable(null);
                setStudentError(
                    axios.isAxiosError(error) && error.response?.status === 429
                        ? "조회가 너무 잦습니다. 잠시 후 다시 시도해 주세요."
                        : "시간표를 불러오지 못했습니다.",
                );
            } finally {
                setStudentLoading(false);
            }
        },
        [term],
    );

    // `student:` 질의가 바뀔 때마다 후보 목록을 서버에서 받아 옵니다.
    // 후보만 옵니다 — 시간표는 하나를 고른 뒤에 따로 받습니다.
    useEffect(() => {
        if (studentQuery === null) {
            setStudentSearch(null);
            setStudentTimetable(null);
            setStudentError(null);
            return;
        }
        let cancelled = false;
        setStudentLoading(true);
        setStudentError(null);
        searchStudents(studentQuery)
            .then((result) => {
                if (cancelled) return;
                setStudentSearch(result);
                // 후보가 딱 한 명이면 한 단계를 건너뜁니다
                if (result.students.length === 1) {
                    void loadStudentTimetable(result.students[0].stuId);
                } else {
                    setStudentTimetable(null);
                }
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                setStudentSearch(null);
                setStudentError(
                    axios.isAxiosError(error) && error.response?.status === 429
                        ? "조회가 너무 잦습니다. 잠시 후 다시 시도해 주세요."
                        : "검색에 실패했습니다.",
                );
            })
            .finally(() => {
                if (!cancelled) setStudentLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentQuery, term]);

    useEffect(() => {
        if (location.pathname !== "/") return;
        const handler = setTimeout(() => {
            const currentParams = new URLSearchParams(location.search);
            if (searchTerm !== currentParams.get("q")) {
                if (searchTerm) currentParams.set("q", searchTerm);
                else currentParams.delete("q");
                const qs = currentParams.toString();
                navigate(qs ? `/?${qs}` : "/", { replace: true });
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, location.pathname, navigate]);

    useEffect(() => {
        // 학기 분리 이전 버전이 남긴 캐시 정리
        localStorage.removeItem(CACHE_PREFIX);
    }, []);

    useEffect(() => {
        if (!sessionToken) { setLoading(false); return; }
        const token = localStorage.getItem(SESSION_TOKEN_KEY);
        api.get("/auth/me", { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => setCurrentUser(res.data))
            .catch(() => handleLogout());
        fetchInitialData();
    }, [sessionToken]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setSearchTerm(searchInput);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchInput]);

    const buildSearchValue = (
        value: string,
        isTeacher: boolean,
        isRoom: boolean,
    ): string => {
        if (isRoom) return `room:${value}`;
        if (isTeacher) return `teacher:${value}`;
        if (value.includes("-")) return `student:${value}`;
        return value;
    };

    const handleSearchToggle = (
        value: string,
        isTeacher: boolean = false,
        isRoom: boolean = false,
    ) => {
        const finalValue = buildSearchValue(value, isTeacher, isRoom);
        const newValue = searchTerm === finalValue ? "" : finalValue;
        setSearchInput(newValue);
        setSearchTerm(newValue);
        if (location.pathname !== "/")
            navigate(newValue ? `/?q=${encodeURIComponent(newValue)}` : "/");
    };

    const handleSearchSelect = (
        value: string,
        isTeacher: boolean = false,
        isRoom: boolean = false,
    ) => {
        const finalValue = buildSearchValue(value, isTeacher, isRoom);
        setSearchInput(finalValue);
        setSearchTerm(finalValue);
        if (location.pathname !== "/")
            navigate(`/?q=${encodeURIComponent(finalValue)}`);
    };

    const toggleSubject = (name: string) => {
        setExpandedSubjects((prev) =>
            prev.includes(name)
                ? prev.filter((s) => s !== name)
                : [...prev, name],
        );
    };

    const pageFallback = (
        <div className="min-h-screen bg-retro-bg flex items-center justify-center">
            <p className="font-black uppercase tracking-widest text-black/30 animate-pulse">Loading...</p>
        </div>
    );

    if (!sessionToken) {
        return (
            <Suspense fallback={pageFallback}>
                <LoginPage onLogin={handleLogin} />
            </Suspense>
        );
    }

    // 아이디·비밀번호로 들어온 옛 계정은 학교 구글 계정을 붙이기 전까지 막습니다 —
    // 누구 계정인지 모르면 이수 기록을 남길 수 없습니다
    if (currentUser && !currentUser.email) {
        return (
            <GoogleLinkModal
                username={currentUser.username}
                onLinked={(info) =>
                    setCurrentUser((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  email: info.email,
                                  stu_id: info.stu_id,
                                  student_name: info.student_name,
                              }
                            : prev,
                    )
                }
                onLogout={handleLogout}
            />
        );
    }

    return (
        <div className="min-h-screen bg-retro-bg text-retro-fg font-sans">
            <Navigation
                onLogoClick={() => {
                    setSearchInput("");
                    navigate("/");
                }}
                onLogout={handleLogout}
                isAdmin={hasRole(currentUser?.role, "admin")}
                username={currentUser?.username ?? ""}
                terms={availableTerms}
                currentTerm={term}
                onTermChange={handleTermChange}
            />
            <div className="flex pt-20">
                <Sidebar
                    activePage={
                        location.pathname === "/"
                            ? "home"
                            : location.pathname.slice(1)
                    }
                    setActivePage={(id) =>
                        navigate(id === "home" ? "/" : `/${id}`)
                    }
                    showTrade={tradeAvailable}
                />
                <main className="flex-1 p-4 md:p-10 transition-all duration-300 md:ml-64 min-w-0 pb-20 md:pb-10">
                    <div className="max-w-6xl mx-auto">
                        <Suspense fallback={<div className="py-40 flex items-center justify-center"><p className="font-black uppercase tracking-widest text-black/30 animate-pulse">Loading...</p></div>}>
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <SearchPage
                                        searchInput={searchInput}
                                        setSearchInput={setSearchInput}
                                        searchTerm={searchTerm}
                                        studentCounts={studentCounts}
                                        selectedYears={selectedYears}
                                        setSelectedYears={setSelectedYears}
                                        lastUpdated={lastUpdated}
                                        fetchInitialData={fetchInitialData}
                                        searchResult={searchResult}
                                        searchMode={searchMode}
                                        isConsolidatedView={isConsolidatedView}
                                        isModifierPressed={isModifierPressed}
                                        hoveredEntityId={hoveredEntityId}
                                        setHoveredEntityId={setHoveredEntityId}
                                        handleSearchToggle={handleSearchToggle}
                                        handleSearchSelect={handleSearchSelect}
                                        stats={stats}
                                        loading={loading}
                                        displayData={displayData}
                                        teacherSubjectMap={teacherSubjectMap}
                                        expandedSubjects={expandedSubjects}
                                        toggleSubject={toggleSubject}
                                        studentQuery={studentQuery}
                                        studentSearch={studentSearch}
                                        studentTimetable={studentTimetable}
                                        studentLoading={studentLoading}
                                        studentError={studentError}
                                        onSelectStudent={loadStudentTimetable}
                                    />
                                }
                            />
                            <Route
                                path="/emptyroomfinder"
                                element={
                                    <RoomsPage
                                        allClassesData={allClassesData}
                                        onRoomSearch={(room) => handleSearchSelect(room, false, true)}
                                    />
                                }
                            />
                            <Route
                                path="/analysis"
                                element={
                                    <AnalysisPage
                                        allClassesData={allClassesData}
                                        studentCounts={studentCounts}
                                        lastUpdated={lastUpdated}
                                        fetchInitialData={fetchInitialData}
                                        handleSearch={handleSearchToggle}
                                        term={term}
                                    />
                                }
                            />
                            <Route
                                path="/browse"
                                element={
                                    <BrowsePage
                                        allClassesData={allClassesData}
                                        handleSearch={handleSearchSelect}
                                    />
                                }
                            />
                            {tradeAvailable && (
                                <Route
                                    path="/trade"
                                    element={
                                        <TradePage
                                            allClassesData={allClassesData}
                                            term={term}
                                            myStuId={currentUser?.stu_id ?? null}
                                        />
                                    }
                                />
                            )}
                            <Route
                                path="/friends"
                                element={
                                    <FriendsPage
                                        term={term}
                                        myStuId={currentUser?.stu_id ?? null}
                                    />
                                }
                            />
                            <Route
                                path="/zamong"
                                element={
                                    <ZamongPage
                                        stuId={currentUser?.stu_id ?? null}
                                        studentName={currentUser?.student_name ?? null}
                                    />
                                }
                            />
                            <Route
                                path="/calendar"
                                element={
                                    <CalendarPage
                                        role={currentUser?.role ?? "user"}
                                        stuId={currentUser?.stu_id ?? null}
                                    />
                                }
                            />
                            <Route
                                path="/about"
                                element={<SettingsPage />}
                            />
                            {/* Admin 도 아직 없습니다 — bench 백엔드에 `/admin/*` 을 등록하지
                                않았습니다. `/admin/students` 가 전교생 명단을 그대로 돌려주기
                                때문입니다. 관리 화면이 필요해지면 안전한 것만 골라 새로 만듭니다 */}
                            <Route
                                path="*"
                                element={<Navigate to="/" replace />}
                            />
                        </Routes>
                        </Suspense>
                    </div>
                </main>
            </div>
            <BottomNav
                activePage={
                    location.pathname === "/"
                        ? "home"
                        : location.pathname.slice(1)
                }
                setActivePage={(id) =>
                    navigate(id === "home" ? "/" : `/${id}`)
                }
                showTrade={tradeAvailable}
            />
        </div>
    );
};

export default App;
