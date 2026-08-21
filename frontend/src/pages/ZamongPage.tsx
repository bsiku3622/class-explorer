/**
 * 자몽 — 학교에서 돌려 쓰는 Zamong 워크북을 앱으로 옮긴 화면.
 *
 * 이 파일은 **껍데기**입니다: 받아오고, 저장하고, 탭을 고릅니다. 계산은
 * `lib/zamong.ts`, 화면은 `components/zamong/*` 가 맡습니다.
 *
 * ## ⚠️ 자몽은 학교 수강 이력과 이어져 있지 않습니다
 *
 * 예전에는 수집된 학기를 그대로 이수로 박아 두고 손도 못 대게 했습니다. 재수강한
 * 과목이 두 학기에 나오면 어느 쪽이 인정되는지 화면이 정할 수 없었고, 사람이 고칠
 * 길도 없었습니다. 학사 사이트를 붙이면 같은 문제가 더 커집니다.
 *
 * 그래서 이력은 **처음 한 번 밑칠**에만 씁니다 — 자몽이 완전히 비어 있는 사람에게
 * 한 번 물어보고, 받아들이면 그때부터는 본인이 적은 값만 남습니다. 두 번 다시
 * 맞춰 보지도, 덮어쓰지도 않습니다. `seeded` 플래그가 그 "한 번"을 기억합니다.
 *
 * 화면에 이력을 늘어놓는 자리도 없습니다. 대신 **로드맵**이 본인이 담은 것을
 * 학기별로 보여 줍니다 — 워크북 `Zamong` 시트가 하던 일 그대로입니다.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, GraduationCap, Info, TriangleAlert, Upload, X } from "lucide-react";
import api from "../lib/api";
import { authHeader } from "../lib/session";
import { fetchCurriculum, fetchProgress } from "../lib/curriculumApi";
import {
    type Course,
    type Curriculum,
    type ProgressTerm,
    buildPrereqIndex,
    buildUnlockIndex,
    courseDepths,
    prereqLine,
    CATEGORY_LABEL,
} from "../lib/curriculum";
import {
    buildCourseOrder,
    DEFAULT_GRADUATION,
    DEFAULT_TERM_SLOTS,
    TIER_COLOR,
    TIER_LABEL,
    TIER_ORDER,
    emptyHours,
    isBlank,
    summarize,
    termSlotOf,
    type HourInput,
    type TermSlot,
    type ZamongEntry,
    type ZamongMap,
} from "../lib/zamong";
import { getStudentColor } from "../lib/utils";
import RetroButton from "../components/atoms/RetroButton";
import RetroCard from "../components/atoms/RetroCard";
import PageHeader from "../components/molecules/PageHeader";
import CourseBoard from "../components/zamong/CourseBoard";
import Roadmap from "../components/zamong/Roadmap";

interface ZamongPageProps {
    stuId: string | null;
    studentName: string | null;
}

/** 상세의 관계 한 줄 — 라벨 폭이 같아야 "선수 / 후수" 가 한 열로 읽힙니다 */
const Relation: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <p className="flex gap-2 text-[12px] font-bold text-black/60">
        <span className="w-14 shrink-0 font-black text-black/35">{label}</span>
        <span className="min-w-0">{value}</span>
    </p>
);

const ZamongPage: React.FC<ZamongPageProps> = ({ stuId, studentName }) => {
    const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [entries, setEntries] = useState<ZamongMap>({});
    const [hours, setHours] = useState<HourInput>(emptyHours);
    /** 밑칠을 이미 물어봤는지. 한 번 정하면 다시 안 묻습니다 */
    const [seeded, setSeeded] = useState(true);
    /** 밑칠 제안에만 쓰는 학교 데이터 — 화면 어디에도 늘어놓지 않습니다 */
    const [seedSource, setSeedSource] = useState<ProgressTerm[]>([]);
    /** 지금 보고 있는 학과 판. 로드맵은 위에 고정이라 여기 섞이지 않습니다 */
    const [department, setDepartment] = useState<string>("수학");
    /**
     * 마우스가 올라온 과목 — **잠깐뿐입니다.** 나가면 `null` 로 돌아갑니다.
     *
     * 눌러 둔 과목(`selected`)과 다릅니다. 호버는 훑는 것이고 클릭은 붙잡는 것이라,
     * 상세는 `focused ?? selected` 로 봅니다 — 훑는 동안은 그 과목을 보여 주고, 손을
     * 치우면 붙잡아 둔 것으로 돌아옵니다. 호버만 쓰면 상세를 읽으러 눈을 내리는
     * 순간 사라집니다.
     */
    const [focused, setFocused] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);

    /**
     * ⚠️ **불러오기에 성공한 뒤에만 저장합니다.**
     *
     * 저장은 전체 교체(`PUT /curriculum/grades`)라, 화면이 빈 상태에서 한 번만 돌아도
     * 서버 기록이 통째로 사라집니다. 그래서 마운트 직후를 막는 플래그가 있는데 —
     * 한동안 **요청이 실패해도 이 플래그를 켜고 있었습니다.** 네트워크가 한 번 튀면
     * 빈 화면이 그대로 저장돼 자몽이 날아가는 길이었습니다.
     *
     * 이제 응답을 받은 쪽만 켭니다. 못 받았으면 그 부분은 저장하지 않고, 화면에
     * "지금 고친 건 저장되지 않습니다" 를 띄웁니다 — 조용히 안 되는 게 제일 나쁩니다.
     */
    const restored = useRef(false);
    /** 시수·밑칠 여부는 따로 저장되므로 플래그도 따로입니다 */
    const stateRestored = useRef(false);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        fetchCurriculum()
            .then(setCurriculum)
            .catch(() => setLoadError("교육과정 데이터를 불러오지 못했습니다."));
    }, []);

    useEffect(() => {
        if (!stuId) return;
        let cancelled = false;
        restored.current = false;
        stateRestored.current = false;
        setLoadFailed(false);

        Promise.all([
            api.get("/curriculum/grades", { headers: authHeader() }).catch(() => null),
            api.get("/state/zamong", { headers: authHeader() }).catch(() => null),
        ]).then(([gradeRes, stateRes]) => {
            if (cancelled) return;

            if (gradeRes) {
                const loaded: ZamongMap = {};
                (gradeRes.data?.entries ?? []).forEach(
                    (row: {
                        course: string;
                        grade: string | null;
                        term: string | null;
                        is_ec: boolean;
                    }) => {
                        loaded[row.course] = {
                            term: (row.term ?? null) as ZamongEntry["term"],
                            grade: row.grade ?? null,
                            isEc: Boolean(row.is_ec),
                        };
                    },
                );
                setEntries(loaded);
                // ⚠️ **받아온 뒤에만 켭니다.** 실패했는데 켜면, 빈 화면이 그대로
                // 저장돼 서버 기록을 지웁니다 (아래 저장 effect 참고)
                restored.current = true;
            }

            const saved = stateRes?.data?.data;
            if (stateRes) {
                setHours({
                    self_dev: Number(saved?.self_dev) || 0,
                    collab: Number(saved?.collab) || 0,
                    global: Number(saved?.global) || 0,
                });
                stateRestored.current = true;
            }

            if (!gradeRes || !stateRes) {
                setLoadFailed(true);
                return;
            }

            // 이미 뭔가 적어 둔 사람에게는 밑칠을 권하지 않습니다
            const answered =
                Boolean(saved?.seeded) || Object.keys(gradeRes.data?.entries ?? {}).length > 0;
            setSeeded(answered);

            // 물어볼 일이 있을 때만 학교 데이터를 꺼내 옵니다
            if (!answered) {
                fetchProgress(stuId)
                    .then((terms) => {
                        if (!cancelled) setSeedSource(terms);
                    })
                    .catch(() => {});
            }
        });

        return () => {
            cancelled = true;
        };
    }, [stuId]);

    // 고를 때마다 요청을 보내면 카드를 죽 채우는 동안 수십 번이 나갑니다 — 손이 멈추면
    // 한 번 보냅니다. 전체 교체라 마지막 저장 하나면 충분합니다
    const saveTimer = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (!restored.current || !stuId) return;
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
            const payload = Object.entries(entries)
                .filter(([, entry]) => !isBlank(entry))
                .map(([course, entry]) => ({
                    course,
                    grade: entry.grade,
                    term: entry.term,
                    is_ec: entry.isEc,
                }));
            api.put("/curriculum/grades", { entries: payload }, { headers: authHeader() }).catch(
                () => {},
            );
        }, 600);
        return () => window.clearTimeout(saveTimer.current);
    }, [entries, stuId]);

    const stateTimer = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (!stateRestored.current || !stuId) return;
        window.clearTimeout(stateTimer.current);
        stateTimer.current = window.setTimeout(() => {
            api.put("/state/zamong", { data: { ...hours, seeded } }, { headers: authHeader() }).catch(
                () => {},
            );
        }, 600);
        return () => window.clearTimeout(stateTimer.current);
    }, [hours, seeded, stuId]);

    const byName = useMemo(
        () => new Map((curriculum?.courses ?? []).map((course) => [course.name, course])),
        [curriculum],
    );
    const prereqIndex = useMemo(
        () => buildPrereqIndex(curriculum?.prerequisites ?? []),
        [curriculum],
    );
    const unlockIndex = useMemo(
        () => buildUnlockIndex(curriculum?.prerequisites ?? []),
        [curriculum],
    );

    const slots: TermSlot[] = useMemo(
        () => (curriculum?.terms as TermSlot[] | undefined) ?? DEFAULT_TERM_SLOTS,
        [curriculum],
    );

    /**
     * 학기 안 과목 순서 — 학과 → 선수 깊이 → 가나다.
     *
     * 학과 순서는 서버가 준 `departments` 그대로라, 아래 학과 고르는 버튼 줄과 같은
     * 차례가 됩니다.
     */
    const courseOrder = useMemo(
        () =>
            buildCourseOrder(
                byName,
                (curriculum?.departments ?? []).map((d) => d.name),
                courseDepths(curriculum?.courses ?? [], curriculum?.prerequisites ?? []),
            ),
        [byName, curriculum],
    );

    const summary = useMemo(
        () =>
            summarize(
                entries,
                byName,
                slots,
                curriculum?.graduation ?? DEFAULT_GRADUATION,
                curriculum?.grade_points ?? {},
                hours,
                courseOrder,
            ),
        [entries, byName, slots, curriculum, hours, courseOrder],
    );

    const update = useCallback((name: string, patch: Partial<ZamongEntry>) => {
        setEntries((prev) => {
            const next = { ...prev };
            const merged = { ...(prev[name] ?? { term: null, grade: null, isEc: false }), ...patch };
            // 학기를 비우면 카드를 지웁니다 — 워크북과 같습니다. 학기 없는 평어는
            // 어느 학기 학점인지 정할 수 없어 셈에서 통째로 빠집니다
            if (isBlank(merged)) delete next[name];
            else next[name] = merged;
            return next;
        });
    }, []);

    /**
     * 밑칠 — 학교 데이터를 자몽에 **한 번** 옮겨 적습니다.
     *
     * 재수강한 과목은 자몽에 한 칸뿐이라 나중 학기가 이깁니다. 그게 틀릴 수 있다는
     * 걸 제안 문구에 적어 두고, 고치는 건 카드에서 하면 됩니다.
     */
    const applySeed = useCallback(() => {
        if (!stuId) return;
        const next: ZamongMap = {};
        seedSource.forEach((term) => {
            const slot = termSlotOf(stuId, term.year, term.semester);
            if (!slot) return;
            term.courses.forEach((item) => {
                if (!item.course || !byName.has(item.course)) return;
                next[item.course] = {
                    term: slot,
                    grade: null,
                    isEc: item.subject.endsWith("(EC)"),
                };
            });
        });
        setEntries(next);
        setSeeded(true);
        setSeedSource([]);
    }, [stuId, seedSource, byName]);

    /**
     * 엑셀 업로드 — 학교에서 받아 채워 둔 워크북을 그대로 옮깁니다.
     *
     * 서버가 읽습니다. 브라우저에서 xlsx 를 열려면 파서를 하나 더 들여야 하는데
     * (SheetJS 는 1MB 가까이 됩니다), 서버에는 교육과정 seed 를 만들 때 쓰던 리더가
     * 이미 있습니다.
     *
     * ⚠️ **합치지 않고 갈아끼웁니다.** 워크북이 그 사람의 자몽 전체라, 일부만 덮으면
     * 앱에서 지운 과목이 되살아납니다. 그래서 이미 적어 둔 게 있으면 먼저 묻습니다.
     */
    const [uploading, setUploading] = useState(false);
    const [uploadNote, setUploadNote] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const uploadWorkbook = useCallback(
        async (file: File) => {
            const existing = Object.keys(entries).length;
            if (
                existing > 0 &&
                !window.confirm(
                    `지금 적혀 있는 ${existing}과목을 워크북 내용으로 **바꿉니다.** 계속할까요?`,
                )
            ) {
                return;
            }

            setUploading(true);
            setUploadNote(null);
            const form = new FormData();
            form.append("file", file);
            try {
                const { data } = await api.post("/curriculum/import-workbook", form, {
                    headers: authHeader(),
                });
                // 서버가 이미 갈아끼웠으니 방금 저장한 값을 그대로 화면에 올립니다.
                // 다시 받아 오면 디바운스 저장과 순서가 꼬일 수 있습니다
                const res = await api.get("/curriculum/grades", { headers: authHeader() });
                const loaded: ZamongMap = {};
                (res.data?.entries ?? []).forEach(
                    (row: {
                        course: string;
                        grade: string | null;
                        term: string | null;
                        is_ec: boolean;
                    }) => {
                        loaded[row.course] = {
                            term: (row.term ?? null) as ZamongEntry["term"],
                            grade: row.grade ?? null,
                            isEc: Boolean(row.is_ec),
                        };
                    },
                );
                setEntries(loaded);
                setSeeded(true);
                setSeedSource([]);
                const missed = data.unknown_courses?.length ?? 0;
                setUploadNote(
                    `${data.imported}과목을 옮겼습니다` +
                        (data.graded ? ` · 평어 ${data.graded}개` : "") +
                        (missed ? ` · 교육과정에 없어 건너뛴 과목 ${missed}개` : ""),
                );
            } catch (error) {
                const detail =
                    (error as { response?: { data?: { detail?: string } } })?.response?.data
                        ?.detail ?? "엑셀을 읽지 못했습니다. 잠시 후 다시 시도해주세요.";
                setUploadNote(detail);
            } finally {
                setUploading(false);
                if (fileRef.current) fileRef.current.value = "";
            }
        },
        [entries],
    );

    const departments = useMemo(
        () => (curriculum?.departments ?? []).map((d) => d.name),
        [curriculum],
    );
    const activeDepartment = useMemo(
        () => curriculum?.departments.find((d) => d.name === department) ?? null,
        [curriculum, department],
    );

    const shownName = focused ?? selected;
    const focusedCourse: Course | undefined = shownName ? byName.get(shownName) : undefined;

    const openCourse = useCallback(
        (name: string) => {
            const course = byName.get(name);
            if (!course) return;
            setDepartment(course.department);
            setSelected(course.name);
        },
        [byName],
    );

    const jumpToUnscheduled = useCallback(() => {
        const first = summary.unscheduled[0];
        if (first) openCourse(first);
    }, [summary.unscheduled, openCourse]);

    if (loadError) {
        return (
            <div className="flex flex-col gap-6 pb-20">
                <PageHeader title="Zamong" subtitle="Curriculum Progress" icon={GraduationCap} />
                <RetroCard className="bg-white p-8 text-center">
                    <p className="font-black uppercase tracking-widest text-black/40">{loadError}</p>
                </RetroCard>
            </div>
        );
    }

    const studentColor = stuId ? getStudentColor(stuId) : "#000000";
    const seedCount = seedSource.reduce((sum, term) => sum + term.courses.length, 0);

    return (
        <div className="flex flex-col gap-3 pb-20 md:gap-4">
            <PageHeader
                title="Zamong"
                subtitle="Curriculum Progress"
                icon={GraduationCap}
                action={
                    stuId && (
                        <span
                            className="border-2 px-2 py-1 text-xs font-black italic"
                            style={{
                                backgroundColor: `${studentColor}15`,
                                borderColor: studentColor,
                                color: studentColor,
                            }}
                        >
                            {stuId} {studentName}
                        </span>
                    )
                }
            />

            {!curriculum ? (
                <RetroCard className="bg-white p-8 text-center">
                    <p className="animate-pulse font-black uppercase tracking-widest text-black/30">
                        Loading curriculum...
                    </p>
                </RetroCard>
            ) : !stuId ? (
                <RetroCard className="space-y-3 bg-white p-8 text-center">
                    <p className="font-black uppercase tracking-widest text-black/40">
                        학번을 확인하지 못했습니다
                    </p>
                    <p className="text-xs font-bold text-black/40">
                        학교 구글 계정으로 다시 들어와주세요. 로그아웃 후 다시 로그인하면
                        학번이 자동으로 확인됩니다.
                    </p>
                </RetroCard>
            ) : (
                <>
                    {/* 불러오기가 실패하면 저장도 막혀 있습니다. 그 사실을 안 알려 주면
                        한참 채워 넣고 새로고침했다가 통째로 잃습니다 */}
                    {loadFailed && (
                        <RetroCard shadow="sm" className="bg-retro-primary/15">
                            <div className="flex flex-wrap items-center gap-3 p-3">
                                <TriangleAlert size={16} strokeWidth={2.5} className="shrink-0" />
                                <p className="min-w-0 flex-1 text-[12px] font-bold leading-relaxed">
                                    기록을 불러오지 못했습니다. <b>지금 고치는 것은 저장되지
                                    않습니다</b> — 새로고침해서 다시 불러와주세요.
                                </p>
                                <RetroButton size="sm" onClick={() => window.location.reload()}>
                                    새로고침
                                </RetroButton>
                            </div>
                        </RetroCard>
                    )}

                    {/* 엑셀은 늘 올릴 수 있어야 합니다 — 배너는 한 번 지나가면 다시
                        안 뜨는데, 워크북은 나중에도 갱신할 일이 있습니다 */}
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void uploadWorkbook(file);
                        }}
                    />

                    {/* 첫 설정 배너 — 자몽이 완전히 비어 있는 사람에게 딱 한 번 */}
                    {!seeded && (
                        <RetroCard shadow="sm" className="bg-retro-accent-light">
                            <div className="flex flex-wrap items-center gap-3 p-4">
                                <div className="min-w-0 flex-1 basis-64">
                                    <p className="text-sm font-black">자몽을 채워 둘까요?</p>
                                    <p className="mt-1 text-[11px] font-bold leading-relaxed text-black/55">
                                        쓰던 <b>Zamong 엑셀</b>이 있으면 그대로 올리세요 —
                                        학기·평어·EC 를 전부 읽어 옵니다.
                                        {seedCount > 0 && (
                                            <>
                                                {" "}
                                                없으면 수집된 수강 내역
                                                {` ${seedCount}과목`}으로 밑칠할 수 있습니다.
                                                <br />
                                                <span className="text-retro-accent4">
                                                    단, 재수강한 과목은 한 칸뿐이라 나중 학기로
                                                    들어갑니다 — 그 부분은 직접 확인해주세요.
                                                </span>
                                            </>
                                        )}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <RetroButton
                                        size="sm"
                                        variant="primary"
                                        disabled={uploading}
                                        onClick={() => fileRef.current?.click()}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <Upload size={13} strokeWidth={2.5} />
                                            {uploading ? "읽는 중…" : "엑셀 올리기"}
                                        </span>
                                    </RetroButton>
                                    {seedCount > 0 && (
                                        <RetroButton size="sm" onClick={applySeed}>
                                            수강 내역으로
                                        </RetroButton>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSeeded(true);
                                            setSeedSource([]);
                                        }}
                                        aria-label="직접 채우기"
                                        title="직접 채우기"
                                        className="flex h-8 w-8 items-center justify-center border-2 border-black/25 bg-white transition-colors duration-100 hover:border-black"
                                    >
                                        <X size={14} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </RetroCard>
                    )}

                    {uploadNote && (
                        <p className="flex items-center gap-2 border-2 border-black bg-white px-3 py-1.5 text-[11px] font-bold shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]">
                            {uploadNote}
                            <button
                                type="button"
                                onClick={() => setUploadNote(null)}
                                aria-label="닫기"
                                className="ml-auto shrink-0 text-black/40 hover:text-black"
                            >
                                <X size={13} strokeWidth={2.5} />
                            </button>
                        </p>
                    )}

                    {/* 로드맵은 **고정**입니다 — 학과를 옮겨 다녀도 내가 어디쯤인지는
                        늘 보여야 합니다 */}
                    <Roadmap
                        summary={summary}
                        hours={hours}
                        onHoursChange={(patch) => setHours((prev) => ({ ...prev, ...patch }))}
                        onOpenCourse={openCourse}
                        onMoveCourse={(course, term) => update(course, { term })}
                        catalog={curriculum.courses}
                    />

                    {summary.unscheduled.length > 0 && (
                        <button
                            type="button"
                            onClick={jumpToUnscheduled}
                            className="flex items-center gap-2 self-start border-2 border-retro-accent4 bg-retro-accent4/10 px-3 py-1.5 text-[11px] font-bold shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] transition-all duration-100 hover:translate-x-1 hover:translate-y-1 hover:shadow-[0_0_0_0_rgba(0,0,0,0.2)]"
                        >
                            <TriangleAlert size={13} strokeWidth={2.5} />
                            학기를 안 고른 과목 {summary.unscheduled.length}개는 학점에서 빠져
                            있습니다 — 눌러서 채우기
                        </button>
                    )}

                    {/* 학과 고르기 — 워크북의 시트 탭입니다 */}
                    {/* Browse 의 모드 탭과 **같은 모양**입니다 — `RetroButton size="sm"` 를
                        그대로 쓰고 간격도 `gap-3`. 한때 여기만 크기와 간격을 손으로 키워
                        놨는데, 같은 일을 하는 버튼이 화면마다 다르면 눈이 매번 다시 잽니다 */}
                    <div className="flex flex-wrap items-center gap-3">
                        {departments.map((name) => (
                            <RetroButton
                                key={name}
                                size="sm"
                                isSelected={department === name}
                                onClick={() => {
                                    // 붙잡아 둔 과목은 이 판에 없습니다 — 같이 놓습니다
                                    setDepartment(name);
                                    setSelected(null);
                                }}
                            >
                                {name}
                            </RetroButton>
                        ))}
                        <RetroButton
                            size="sm"
                            className="ml-auto"
                            disabled={uploading}
                            onClick={() => fileRef.current?.click()}
                            title="채워 둔 Zamong 엑셀을 올려 통째로 바꿉니다"
                            icon={<FileUp size={14} strokeWidth={2.5} />}
                        >
                            {uploading ? "읽는 중…" : "엑셀"}
                        </RetroButton>
                    </div>

                    <RetroCard className="space-y-4 bg-white p-4 md:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-base font-black uppercase tracking-widest">
                                        {department}
                                        <span className="ml-2 text-[12px] text-black/35">
                                            {CATEGORY_LABEL[activeDepartment?.category ?? "natural"]}
                                        </span>
                                    </p>
                                    {activeDepartment?.track && (
                                        <p className="text-[13px] font-bold text-black/55">
                                            <span className="mr-1.5 border-2 border-black/20 px-1.5 py-0.5 text-[11px] font-black uppercase tracking-widest">
                                                트랙
                                            </span>
                                            {activeDepartment.track}
                                        </p>
                                    )}
                                    {(activeDepartment?.notes ?? []).map((note) => (
                                        <p
                                            key={note}
                                            className="flex items-start gap-1.5 text-[12px] font-bold text-black/45"
                                        >
                                            <Info
                                                size={14}
                                                strokeWidth={2.5}
                                                className="mt-px shrink-0"
                                            />
                                            {note}
                                        </p>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-[12px] font-bold">
                                    {TIER_ORDER.map((tier) => (
                                        <span key={tier} className="flex items-center gap-1">
                                            {/* 색이 옅어서 테두리가 없으면 안 보입니다 */}
                                            <span
                                                className="h-4 w-4 border-2 border-black/30"
                                                style={{ backgroundColor: TIER_COLOR[tier] }}
                                            />
                                            {TIER_LABEL[tier]}
                                        </span>
                                    ))}
                                    <span className="flex items-center gap-1">
                                        <span className="underline decoration-2 underline-offset-2">
                                            밑줄
                                        </span>
                                        트랙필수
                                    </span>
                                </div>
                            </div>

                            <CourseBoard
                                courses={curriculum.courses}
                                prerequisites={curriculum.prerequisites}
                                department={department}
                                entries={entries}
                                slots={slots}
                                focused={focused}
                                onFocus={setFocused}
                                selected={selected}
                                onSelect={setSelected}
                                onChange={update}
                            />

                            {focusedCourse ? (
                                <div className="space-y-1.5 border-2 border-black bg-retro-accent-light p-4">
                                    <div className="flex flex-wrap items-baseline gap-2">
                                        <span className="text-base font-black">
                                            {focusedCourse.name}
                                        </span>
                                        {focusedCourse.english_name && (
                                            <span className="text-[12px] font-bold text-black/40">
                                                {focusedCourse.english_name}
                                            </span>
                                        )}
                                        <span className="text-[12px] font-bold text-black/60">
                                            {focusedCourse.credits}학점
                                            {focusedCourse.recommended_semester &&
                                                ` · 권장 ${focusedCourse.recommended_semester}학기`}
                                        </span>
                                    </div>
                                    {(() => {
                                        const edges = prereqIndex.get(focusedCourse.name) ?? [];
                                        const unlocks = unlockIndex.get(focusedCourse.name) ?? [];
                                        // 라벨을 짝으로 답니다 — "선수 / 후수" 는 서로를 보고
                                        // 읽는 값이라, 한쪽만 문장이면 두 줄이 다른 종류처럼
                                        // 보입니다 ("이 과목을 들으면 열립니다" 로 뒀었습니다)
                                        return (
                                            <>
                                                {edges.length > 0 && (
                                                    <Relation
                                                        label="선수 과목"
                                                        value={prereqLine(edges)}
                                                    />
                                                )}
                                                {unlocks.length > 0 && (
                                                    <Relation
                                                        label="후수 과목"
                                                        value={unlocks.join(", ")}
                                                    />
                                                )}
                                            </>
                                        );
                                    })()}
                                    {focusedCourse.description && (
                                        <p className="pt-1 text-[13px] font-medium leading-relaxed text-black/70">
                                            {focusedCourse.description}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[12px] font-bold text-black/40">
                                    카드의 학기 칸을 채우면 이수로 잡힙니다. 과목을 누르면 그
                                    과목과 이어진 선수관계만 남고, 상세가 여기 열립니다.
                                </p>
                            )}
                    </RetroCard>
                </>
            )}
        </div>
    );
};

export default ZamongPage;
