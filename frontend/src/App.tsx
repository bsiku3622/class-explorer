import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import axios from "axios";
import api from "./lib/api";
import { clearCache } from "./lib/cache";
import {
    authHeader,
    clearSessionToken,
    getSessionToken,
    setSessionToken as persistSessionToken,
} from "./lib/session";
import {
    useLocation,
    useNavigate,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import type { SubjectData, Stats, SearchResultStats, Term, Role } from "./types";
import { hasRole } from "./lib/utils";
import { searchInClient } from "./lib/searchEngine";
import { isTradeAvailable } from "./lib/features";
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
const AdminPage = React.lazy(() => import("./pages/AdminPage"));
const TradePage = React.lazy(() => import("./pages/TradePage"));
const HomePage = React.lazy(() => import("./pages/HomePage"));
const ZamongPage = React.lazy(() => import("./pages/ZamongPage"));
const CalendarPage = React.lazy(() => import("./pages/CalendarPage"));
// 개발 전용 — funky-ui 토큰 작업용 컴포넌트 표본집. 메뉴에 올리지 않습니다
const InventoryPage = React.lazy(() => import("./pages/InventoryPage"));

const CACHE_PREFIX = "ksa_class_finder_cache";
/**
 * 캐시된 응답의 스키마 버전. API 응답에 필드가 늘면 올려야 합니다.
 * 안 올리면 예전 응답을 든 브라우저가 최대 1시간 동안 새 필드를 못 받아
 * 학점이 0으로 보이는 식의 문제가 생깁니다.
 */
const CACHE_VERSION = 5;   // 5 = 데이터 회차(version) 동봉
const TERM_KEY = "ksa_selected_term";
const CACHE_EXPIRY = 60 * 60 * 1000;

/** 데이터 캐시는 학기별로 분리 보관 */
const cacheKeyFor = (term: Term) => `${CACHE_PREFIX}_${term.year}_${term.semester}`;

/** `/auth/me` 가 돌려주는 회차 뭉치의 키 */
const termKey = (term: Term) => `${term.year}-${term.semester}`;

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
        getSessionToken,
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
            location.pathname === "/search"
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
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [searchInput, setSearchInput] = useState(initialSearch);
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
    const [searchResult, setSearchResult] = useState<SearchResultStats | null>(
        null,
    );
    const [searchMode, setSearchMode] = useState<
        "general" | "student" | "teacher" | "room"
    >("general");
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
    const [term, setTerm] = useState<Term | null>(loadSavedTerm);
    const [availableTerms, setAvailableTerms] = useState<Term[]>([]);

    // 데이터 회차 — 캐시를 계속 써도 되는지 판단하는 유일한 근거입니다.
    //
    // 서버 값은 `/auth/me` 가 실어 줍니다. 앱을 열 때 캐시 없이 한 번은 나가는 요청이라
    // 여기 얹으면 추가 왕복이 없습니다. ref 를 같이 두는 이유는 `fetchInitialData` 가
    // 캐시를 읽는 순간 최신 값을 봐야 하는데, state 만으로는 닫힌 값이 잡히기 때문입니다
    const [dataVersion, setDataVersion] = useState<number | null>(null);
    const dataVersionsRef = useRef<Record<string, number> | null>(null);
    const [serverVersions, setServerVersions] = useState<Record<string, number> | null>(null);

    const isModifierPressed = useModifierKey();
    const tradeAvailable = isTradeAvailable(term);

    const handleLogout = useCallback(async () => {
        if (getSessionToken()) {
            try {
                await api.post("/auth/logout", {}, { headers: authHeader() });
            } catch (_) {
                // 서버 오류여도 로컬 세션은 정리
            }
        }
        clearSessionToken();
        clearDataCache();
        // 교육과정·급식·교시 캐시도 같이 비웁니다 — 다음 사람이 앞사람이 보던 걸
        // 이어 보면 안 됩니다 (`lib/cache.ts`)
        clearCache();
        setSessionToken(null);
        setCurrentUser(null);
        setAllClassesData([]);
        setDisplayData([]);
        setStats(null);
    }, []);

    const handleLogin = useCallback((token: string) => {
        persistSessionToken(token);
        setSessionToken(token);
    }, []);

    // 검색이 "/" 에서 "/search" 로 옮겨졌습니다. 예전에 공유된 `/?q=…` 링크가 죽지
    // 않도록 홈에 `?q=` 가 붙어 오면 검색으로 넘깁니다.
    useEffect(() => {
        if (location.pathname === "/" && location.search.includes("q=")) {
            navigate(`/search${location.search}`, { replace: true });
        }
    }, [location.pathname, location.search, navigate]);

    useEffect(() => {
        if (location.pathname === "/search") {
            const q = new URLSearchParams(location.search).get("q") || "";
            if (q !== searchInput) {
                setSearchInput(q);
                setSearchTerm(q);
            }
        }
    }, [location.pathname]);

    const isLogicalSearch = useMemo(
        () =>
            searchTerm.includes("+") ||
            searchTerm.includes("&") ||
            searchTerm.includes("/") ||
            searchTerm.includes("("),
        [searchTerm],
    );

    const isConsolidatedView = useMemo(
        () => searchMode !== "general" || isLogicalSearch,
        [searchMode, isLogicalSearch],
    );

    const studentSubjectMap = useMemo(() => {
        const map: Record<string, string[]> = {};
        allClassesData.forEach((item) => {
            item.sections.forEach((section) => {
                section.students.forEach((student) => {
                    if (!map[student.stuId]) map[student.stuId] = [];
                    if (!map[student.stuId].includes(item.subject))
                        map[student.stuId].push(item.subject);
                });
            });
        });
        return map;
    }, [allClassesData]);

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
        if (!getSessionToken()) return;
        // 학기 미지정(최초 진입)이면 서버가 최신 학기를 골라 응답합니다
        const requestedTerm = targetTerm ?? term;
        try {
            setLoading(true);
            const cached =
                !force && requestedTerm
                    ? localStorage.getItem(cacheKeyFor(requestedTerm))
                    : null;
            if (cached) {
                const { v, timestamp, student_counts, data, available_terms, version } =
                    JSON.parse(cached);
                // 서버가 알려 준 회차와 다르면 아무리 최근이어도 버립니다. TTL 은 이제
                // 백스톱일 뿐이고, 데이터가 갈렸는지는 회차가 말해 줍니다
                const serverVersion = requestedTerm
                    ? dataVersionsRef.current?.[termKey(requestedTerm)]
                    : undefined;
                const stale = serverVersion !== undefined && serverVersion !== version;
                if (v === CACHE_VERSION && !stale && Date.now() - timestamp < CACHE_EXPIRY) {
                    setStudentCounts(student_counts);
                    setSelectedYears(Object.keys(student_counts));
                    setAllClassesData(data);
                    if (available_terms) setAvailableTerms(available_terms);
                    setLastUpdated(timestamp);
                    setDataVersion(typeof version === "number" ? version : null);
                    setLoading(false);
                    return;
                }
            }
            const response = await api.get("/", {
                headers: authHeader(),
                params: requestedTerm
                    ? { year: requestedTerm.year, semester: requestedTerm.semester }
                    : undefined,
            });
            const {
                student_counts,
                data,
                term: resolvedTerm,
                available_terms,
                version: resolvedVersion,
            } = response.data;
            const now = Date.now();
            setDataVersion(typeof resolvedVersion === "number" ? resolvedVersion : null);
            if (resolvedTerm) {
                localStorage.setItem(
                    cacheKeyFor(resolvedTerm),
                    JSON.stringify({
                        v: CACHE_VERSION,
                        timestamp: now,
                        student_counts,
                        data,
                        available_terms,
                        version: resolvedVersion,
                    }),
                );
                localStorage.setItem(TERM_KEY, JSON.stringify(resolvedTerm));
                setTerm(resolvedTerm);
            }
            if (available_terms) setAvailableTerms(available_terms);
            setStudentCounts(student_counts);
            setSelectedYears(Object.keys(student_counts));
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

    const handleSearch = useCallback(() => {
        if (allClassesData.length === 0 || location.pathname !== "/search") return;
        if (selectedYears.length === 0) {
            setDisplayData([]);
            setStats(null);
            setSearchResult(null);
            setSearchMode("general");
            return;
        }
        if (searchTerm.trim()) {
            const result = searchInClient(
                allClassesData,
                searchTerm,
                selectedYears,
            );
            const filteredByYear = result.data
                .map((subject) => ({
                    ...subject,
                    sections: subject.sections.filter((sec) =>
                        sec.students.some((s) =>
                            selectedYears.includes(s.stuId.split("-")[0]),
                        ),
                    ),
                }))
                .filter((subject) => subject.sections.length > 0);
            setDisplayData(filteredByYear);
            setSearchMode(result.mode);
            setSearchResult({
                keyword: result.stats.keyword || searchTerm,
                prefix: result.mode !== "general" ? result.mode : "",
                entities: result.entities,
                total_subjects: result.stats.total_subjects,
                total_sections: result.stats.total_sections,
                total_matched_students: result.stats.total_matched_students,
                warning: result.warning,
            });
            setStats(null);
        } else {
            setSearchMode("general");
            const filteredData = allClassesData
                .map((subject) => ({
                    ...subject,
                    sections: subject.sections.filter((sec) =>
                        sec.students.some((s) =>
                            selectedYears.includes(s.stuId.split("-")[0]),
                        ),
                    ),
                }))
                .filter((subject) => subject.sections.length > 0);
            setDisplayData(filteredData);
            const totalSecs = filteredData.reduce(
                (acc, sub) => acc + sub.sections.length,
                0,
            );
            const activeStus = new Set(
                filteredData.flatMap((sub) =>
                    sub.sections.flatMap((sec) =>
                        sec.students.map((s) => s.stuId),
                    ),
                ),
            );
            setStats({
                total_subjects: filteredData.length,
                total_sections: totalSecs,
                total_active_students: activeStus.size,
            });
            setSearchResult(null);
        }
    }, [searchTerm, selectedYears, allClassesData, location.pathname]);

    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    useEffect(() => {
        if (location.pathname !== "/search") return;
        const handler = setTimeout(() => {
            const currentParams = new URLSearchParams(location.search);
            if (searchTerm !== currentParams.get("q")) {
                if (searchTerm) currentParams.set("q", searchTerm);
                else currentParams.delete("q");
                const qs = currentParams.toString();
                navigate(qs ? `/search?${qs}` : "/search", { replace: true });
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
        api.get("/auth/me", { headers: authHeader() })
            .then((res) => {
                setCurrentUser(res.data);
                const versions = res.data.data_versions ?? {};
                dataVersionsRef.current = versions;
                setServerVersions(versions);
            })
            .catch(() => handleLogout());
        fetchInitialData();
    }, [sessionToken]);

    // 캐시를 먼저 그리고 `/auth/me` 가 나중에 오는 순서가 정상입니다 — 둘을 나란히
    // 보내야 첫 화면이 빠릅니다. 그래서 회차가 늦게 도착해 어긋나는 경우를 여기서 받습니다.
    // 맞으면 아무 일도 안 일어나므로, 추가 요청은 정말 갈렸을 때만 나갑니다
    useEffect(() => {
        if (!serverVersions || !term || dataVersion === null) return;
        const latest = serverVersions[termKey(term)];
        if (latest !== undefined && latest !== dataVersion) {
            fetchInitialData(true, term);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverVersions, term, dataVersion]);

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
        if (location.pathname !== "/search")
            navigate(newValue ? `/search?q=${encodeURIComponent(newValue)}` : "/search");
    };

    const handleSearchSelect = (
        value: string,
        isTeacher: boolean = false,
        isRoom: boolean = false,
    ) => {
        const finalValue = buildSearchValue(value, isTeacher, isRoom);
        setSearchInput(finalValue);
        setSearchTerm(finalValue);
        if (location.pathname !== "/search")
            navigate(`/search?q=${encodeURIComponent(finalValue)}`);
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
                onLinked={(info) => {
                    setCurrentUser((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  email: info.email,
                                  stu_id: info.stu_id,
                                  student_name: info.student_name,
                              }
                            : prev,
                    );
                    // ⚠️ 구글에서 돌아온 직후라면 지금 주소가 `/auth/google` 입니다 —
                    // 창이 닫히면 그 경로에 맞는 라우트가 없어 **빈 화면**이 됩니다.
                    // 주소만 바꾸면(`replaceState`) 라우터가 모르므로 여기서 넘깁니다
                    navigate("/", { replace: true });
                }}
                onLogout={handleLogout}
            />
        );
    }

    return (
        <div className="min-h-screen bg-retro-bg text-retro-fg font-sans">
            <Navigation
                onLogoClick={() => navigate("/")}
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
                    isAdmin={hasRole(currentUser?.role, "admin")}
                    showTrade={tradeAvailable}
                />
                <main className="flex-1 p-4 md:p-10 transition-all duration-300 md:ml-64 min-w-0 pb-20 md:pb-10">
                    <div className="max-w-6xl mx-auto">
                        <Suspense fallback={<div className="py-40 flex items-center justify-center"><p className="font-black uppercase tracking-widest text-black/30 animate-pulse">Loading...</p></div>}>
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <HomePage
                                        term={term}
                                        allClassesData={allClassesData}
                                        myStuId={currentUser?.stu_id ?? null}
                                        studentSubjectMap={studentSubjectMap}
                                        teacherSubjectMap={teacherSubjectMap}
                                        selectedYears={selectedYears}
                                        isModifierPressed={isModifierPressed}
                                        handleSearchToggle={handleSearchToggle}
                                    />
                                }
                            />
                            <Route
                                path="/search"
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
                                        isLogicalSearch={isLogicalSearch}
                                        isConsolidatedView={isConsolidatedView}
                                        isModifierPressed={isModifierPressed}
                                        hoveredEntityId={hoveredEntityId}
                                        setHoveredEntityId={setHoveredEntityId}
                                        handleSearchToggle={handleSearchToggle}
                                        handleSearchSelect={handleSearchSelect}
                                        stats={stats}
                                        loading={loading}
                                        displayData={displayData}
                                        studentSubjectMap={studentSubjectMap}
                                        teacherSubjectMap={teacherSubjectMap}
                                        expandedSubjects={expandedSubjects}
                                        toggleSubject={toggleSubject}
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
                                    />
                                }
                            />
                            <Route
                                path="/browse"
                                element={
                                    <BrowsePage
                                        allClassesData={allClassesData}
                                        studentCounts={studentCounts}
                                        lastUpdated={lastUpdated}
                                        term={term}
                                        myStuId={currentUser?.stu_id ?? null}
                                        fetchInitialData={fetchInitialData}
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
                            {hasRole(currentUser?.role, "admin") && (
                                <Route path="/admin" element={<AdminPage />} />
                            )}
                            {import.meta.env.DEV && (
                                <Route
                                    path="/inventory"
                                    element={<InventoryPage />}
                                />
                            )}
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
                isAdmin={hasRole(currentUser?.role, "admin")}
                showTrade={tradeAvailable}
                onLogout={handleLogout}
            />
        </div>
    );
};

export default App;
