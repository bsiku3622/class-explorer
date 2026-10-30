import React, { useState, useEffect, useCallback } from "react";
import { Shield, Users, MonitorSmartphone, RefreshCw, Trash2, Plus, X, Check, GraduationCap, Archive, Camera, History, FlaskConical, ArrowLeftRight, FileCheck2, CalendarDays, Brain, Signpost } from "lucide-react";
import api from "../lib/api";
import { authHeader } from "../lib/session";
import axios from "axios";
import type { Role } from "../types";
import { particleRo } from "../lib/utils";
import ChangeSummary from "../components/admin/ChangeSummary";
import type { ChangeSummaryData } from "../components/admin/ChangeSummary";
import MaterialReviewPanel from "../components/MaterialReviewPanel";
import FactsPanel from "../components/admin/FactsPanel";
import MajorSurveyPanel from "../components/admin/MajorSurveyPanel";
import {
    Accordion,
    Badge,
    Button,
    Card,
    Code,
    IconButton,
    Input,
    Label,
    Modal,
    Notice,
    PageHeader,
    SectionTitle,
    SegmentedControl,
    Select,
    Surface,
    Text,
} from "@studio-baeks/funky-ui";

interface UserRow {
    id: number;
    username: string;
    role: Role;
    session_count: number;
    /** 시연 계정이 빌려 보는 학번. 평범한 계정은 null */
    demo_stu_id: string | null;
}

/**
 * 저장된 마감(시간대 붙은 ISO) → `datetime-local` 이 먹는 문자열.
 *
 * ⚠️ **입력칸은 보는 사람의 시간대로 씁니다.** 같은 순간을 서울에서 보면 오후 5시,
 * 다른 데서 보면 다른 시각입니다 — 그래서 칸 옆에 KST 로 한 번 더 적어 둡니다.
 */
const toLocalInput = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 입력칸 값(보는 사람의 시간대) → 저장할 절대 시각 */
const fromLocalInput = (value: string): string | null => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** 마감을 **서울 시각**으로 한 줄 — 어느 시간대에서 열어도 같은 문장이 나옵니다 */
const kstLabel = (iso: string | null): string => {
    if (!iso) return "기한 없음";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "읽을 수 없는 값";
    return d.toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        dateStyle: "full",
        timeStyle: "short",
    });
};

/** `/admin/features/trade` 가 돌려주는 모양 */
interface TradeConfig {
    /** 지금 열려 있는가 — 스위치와 마감을 **서버 시계로** 잰 결과 */
    open: boolean;
    enabled: boolean;
    year: number | null;
    semester: number | null;
    /** 시간대를 붙인 ISO. null 이면 기한 없음 */
    until: string | null;
}

interface AdminPageProps {
    /** 만드는 사람의 학번 — 시연 계정에 빌려 줄 수 있는 유일한 학번입니다 */
    myStuId: string | null;
    myName: string | null;
}

/** 권한은 위계라서 한 줄에 하나만 고릅니다 — 위 단계가 아래 것을 다 포함합니다 */
const ROLE_OPTIONS: { value: Role; label: string }[] = [
    { value: "user", label: "User" },
    { value: "manager", label: "Manager" },
    { value: "admin", label: "Admin" },
];

interface SessionRow {
    id: number;
    user_id: number;
    username: string;
    device_type: string;
    ip_address: string | null;
    created_at: string;
    last_used_at: string;
    expires_at: string;
}

interface StudentRow { stuId: string; name: string; }
interface TeacherRow { name: string; section_count: number; }
interface SubjectRow { subject: string; is_ec: boolean; english: string | null; course: string | null; }

type DataTab = "students" | "teachers" | "subjects";

interface TermRow { year: number; semester: number; }

interface VersionRow {
    version: number;
    created_at: string | null;
    source: string;
    note: string | null;
    synced: number | null;
    skipped: number | null;
    errors: number | null;
    elapsed: string | null;
    backup: string | null;
    summary: ChangeSummaryData | null;
}
interface BackupRow { name: string; label: string; created: string; bytes: number; }
interface TimetableOverrideRow { id: number; date: string; source_day: string; title: string; }
const WEEKDAYS = [{ value: "MON", label: "월요일" }, { value: "TUE", label: "화요일" }, { value: "WED", label: "수요일" }, { value: "THU", label: "목요일" }, { value: "FRI", label: "금요일" }];

const formatBytes = (n: number) =>
    n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const termLabel = (t: TermRow) => `${t.year}-${t.semester}`;

/**
 * 서버가 `datetime.utcnow()` 로 적어 시간대 표시가 없습니다. 그대로 넘기면 브라우저가
 * 현지 시각으로 읽어 9시간이 밀리므로 `Z` 를 붙여 UTC 임을 알려 줍니다.
 */
const formatWhen = (iso: string | null): string => {
    if (!iso) return "";
    const at = new Date(/[Z+]/.test(iso.slice(10)) ? iso : `${iso}Z`);
    return Number.isNaN(at.getTime())
        ? ""
        : at.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
};

/** 회차 줄에 접힌 채로 보이는 한 줄 — 펼치지 않아도 규모가 가늠되게 */
const versionHeadline = (row: VersionRow): string => {
    const sum = row.summary;
    if (!sum) return row.source === "seed" ? "기준점" : "";
    const parts: string[] = [];
    const net = (added: number, removed: number) => {
        if (added) parts.push(`+${added}`);
        if (removed) parts.push(`-${removed}`);
    };
    if (sum.classes.added.length || sum.classes.removed.length) {
        parts.push("분반");
        net(sum.classes.added.length, sum.classes.removed.length);
    }
    if (sum.enrollments.added || sum.enrollments.removed) {
        parts.push("수강");
        net(sum.enrollments.added, sum.enrollments.removed);
    }
    if (sum.classes.moved.length) parts.push(`교실 ${sum.classes.moved.length}`);
    if (sum.classes.swapped?.length) parts.push(`교사 ${sum.classes.swapped.length}`);
    if (sum.classes.assigned) parts.push(`교실배정 ${sum.classes.assigned}`);
    return parts.join(" ") || "변화 없음";
};

// ─── 인라인 편집 행 공통 레이아웃 ─────────────────────────────────────────────
interface EditableRowProps {
    label: string;
    sub?: string;
    isEditing: boolean;
    editValue: string;
    onEditValueChange: (v: string) => void;
    onStartEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    placeholder?: string;
    children?: React.ReactNode; // 뷰 모드 추가 요소 (배지 등)
}

const EditableRow: React.FC<EditableRowProps> = ({
    label, sub, isEditing, editValue, onEditValueChange,
    onStartEdit, onSave, onCancel, saving, placeholder, children,
}) => {
    return (
        <Card shadow="raised" padding="0" className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <Text weight="black" truncate className="block">{label}</Text>
                    {sub && <Text variant="micro" weight="bold" tone="muted">{sub}</Text>}
                </div>
                {!isEditing && (
                    <Button size="xs" variant="muted" onClick={onStartEdit} className="shrink-0">
                        Edit
                    </Button>
                )}
            </div>
            {isEditing ? (
                <div className="mt-2 flex gap-2 items-center">
                    <Input
                        autoFocus
                        type="text"
                        shadow
                        size="sm"
                        value={editValue}
                        onChange={(e) => onEditValueChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) onSave();
                            if (e.key === "Escape") onCancel();
                        }}
                        placeholder={placeholder}
                        className="flex-1"
                    />
                    <IconButton icon={Check} size="sm" accent="success" label="저장" onClick={onSave} disabled={saving} className="shrink-0" />
                    <IconButton icon={X} size="sm" label="취소" onClick={onCancel} className="shrink-0" />
                </div>
            ) : (
                children && <div className="mt-1.5">{children}</div>
            )}
        </Card>
    );
};

const AdminPage: React.FC<AdminPageProps> = ({ myStuId, myName }) => {
    const [openSections, setOpenSections] = useState({ materials: false, memory: false, users: true, survey: false, sessions: true, data: false, versions: false, backups: false, trade: false, timetable: false });

    // Users
    const [users, setUsers] = useState<UserRow[]>([]);
    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState<Role>("user");
    const [newDemo, setNewDemo] = useState(false);
    const [trade, setTrade] = useState<TradeConfig | null>(null);
    const [tradeBusy, setTradeBusy] = useState(false);
    const [tradeError, setTradeError] = useState("");
    const [createError, setCreateError] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    // Sessions
    const [sessions, setSessions] = useState<SessionRow[]>([]);

    // Sync — 학기를 골라서 받습니다. DB에 아직 없는 학기도 직접 입력해 처음 채울 수 있습니다
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncResult, setSyncResult] = useState<
        {
            ok: boolean; term?: string; synced?: number; skipped?: number;
            errors?: number; elapsed?: string; backup?: string;
            changed?: boolean; version?: number; summary?: ChangeSummaryData | null;
        } | null
    >(null);
    const [terms, setTerms] = useState<TermRow[]>([]);
    const [syncTerm, setSyncTerm] = useState<TermRow | null>(null);
    const [customTerm, setCustomTerm] = useState<TermRow | null>(null);

    // 회차 이력 — 수집 대상 학기와 **따로 고릅니다**. 지난 학기 이력을 보려고
    // 수집 대상까지 바꿔 놓으면, 그 상태로 Fetch 를 눌렀을 때 엉뚱한 학기를 긁습니다
    const [versions, setVersions] = useState<VersionRow[]>([]);
    const [openVersion, setOpenVersion] = useState<number | null>(null);
    const [versionTerm, setVersionTerm] = useState<TermRow | null>(null);

    // Backups
    const [backups, setBackups] = useState<BackupRow[]>([]);
    const [backupTotal, setBackupTotal] = useState(0);
    const [backupBusy, setBackupBusy] = useState(false);

    // Data Management
    const [dataTab, setDataTab] = useState<DataTab>("students");
    const [dataSearch, setDataSearch] = useState("");

    const [students, setStudents] = useState<StudentRow[]>([]);
    const [editingStu, setEditingStu] = useState<string | null>(null);
    const [stuEditVal, setStuEditVal] = useState("");
    const [stuSaving, setStuSaving] = useState(false);

    const [teachers, setTeachers] = useState<TeacherRow[]>([]);
    const [editingTeacher, setEditingTeacher] = useState<string | null>(null);
    const [teacherEditVal, setTeacherEditVal] = useState("");
    const [teacherSaving, setTeacherSaving] = useState(false);

    const [subjects, setSubjects] = useState<SubjectRow[]>([]);
    const [overrides, setOverrides] = useState<TimetableOverrideRow[]>([]);
    const [overrideDate, setOverrideDate] = useState("");
    const [overrideDay, setOverrideDay] = useState("MON");
    const [overrideTitle, setOverrideTitle] = useState("");

    const [error, setError] = useState("");

    // ── fetchers ──────────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        try {
            const res = await api.get("/admin/users", { headers: authHeader() });
            setUsers(res.data);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load users");
        }
    }, []);

    const fetchSessions = useCallback(async () => {
        try {
            const res = await api.get("/admin/sessions", { headers: authHeader() });
            setSessions(res.data);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load sessions");
        }
    }, []);

    const fetchStudents = useCallback(async () => {
        try {
            const res = await api.get("/admin/students", { headers: authHeader() });
            setStudents(res.data);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load students");
        }
    }, []);

    const fetchTeachers = useCallback(async () => {
        try {
            const res = await api.get("/admin/teachers", { headers: authHeader() });
            setTeachers(res.data);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load teachers");
        }
    }, []);

    const fetchSubjects = useCallback(async () => {
        try {
            const res = await api.get("/admin/subjects", { headers: authHeader() });
            setSubjects(res.data);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load subjects");
        }
    }, []);

    const fetchTerms = useCallback(async () => {
        try {
            const res = await api.get("/admin/terms", { headers: authHeader() });
            const rows: TermRow[] = res.data.terms ?? [];
            setTerms(rows);
            setSyncTerm((prev) => prev ?? rows[0] ?? null);
            setVersionTerm((prev) => prev ?? rows[0] ?? null);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load terms");
        }
    }, []);

    const fetchVersions = useCallback(async (target?: TermRow | null) => {
        try {
            const res = await api.get("/admin/versions", {
                headers: authHeader(),
                params: target ? { year: target.year, semester: target.semester } : undefined,
            });
            setVersions(res.data.versions ?? []);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load versions");
        }
    }, []);

    const fetchBackups = useCallback(async () => {
        try {
            const res = await api.get("/admin/backups", { headers: authHeader() });
            setBackups(res.data.backups ?? []);
            setBackupTotal(res.data.total_bytes ?? 0);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load backups");
        }
    }, []);

    const fetchTrade = useCallback(async () => {
        try {
            const res = await api.get("/admin/features/trade", { headers: authHeader() });
            setTrade(res.data);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load trade config");
        }
    }, []);

    const fetchOverrides = useCallback(async () => {
        try {
            const res = await api.get("/admin/timetable-overrides", { headers: authHeader() });
            setOverrides(res.data);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to load timetable overrides");
        }
    }, []);

    /**
     * 준 칸만 보냅니다 — 스위치만 내리려고 마감까지 다시 보내면, 그 사이 다른 자리에서
     * 바꾼 값을 덮어씁니다.
     */
    const saveTrade = async (patch: Record<string, unknown>) => {
        setTradeError("");
        setTradeBusy(true);
        try {
            const res = await api.patch("/admin/features/trade", patch, { headers: authHeader() });
            setTrade(res.data);
        } catch (e) {
            if (axios.isAxiosError(e)) setTradeError(e.response?.data?.detail || "저장하지 못했습니다");
        } finally { setTradeBusy(false); }
    };

    useEffect(() => {
        fetchUsers();
        fetchSessions();
        fetchTerms();
    }, [fetchUsers, fetchSessions, fetchTerms]);

    // ── data management handlers ───────────────────────────────────────────────
    const handleSaveStu = async (stuId: string) => {
        if (!stuEditVal.trim()) return;
        setStuSaving(true);
        try {
            await api.patch(`/admin/students/${encodeURIComponent(stuId)}`, { name: stuEditVal }, { headers: authHeader() });
            setStudents((prev) => prev.map((s) => s.stuId === stuId ? { ...s, name: stuEditVal.trim() } : s));
            setEditingStu(null);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to update student");
        } finally { setStuSaving(false); }
    };

    const handleSaveTeacher = async (oldName: string) => {
        if (!teacherEditVal.trim()) return;
        setTeacherSaving(true);
        try {
            await api.patch(`/admin/teachers/${encodeURIComponent(oldName)}`, { new_name: teacherEditVal }, { headers: authHeader() });
            setTeachers((prev) => prev.map((t) => t.name === oldName ? { ...t, name: teacherEditVal.trim() } : t));
            setEditingTeacher(null);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to rename teacher");
        } finally { setTeacherSaving(false); }
    };

    // ── user handlers ─────────────────────────────────────────────────────────
    /** 시연 계정이 누구로 보이는지 — 화면 문구와 조사에 함께 씁니다 */
    const demoLabel = `${myStuId ?? ""}${myName ? ` ${myName}` : ""}`;

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError("");
        setCreateLoading(true);
        try {
            await api.post("/admin/users", { username: newUsername, password: newPassword, role: newRole, demo: newDemo }, { headers: authHeader() });
            setNewUsername(""); setNewPassword(""); setNewRole("user"); setNewDemo(false);
            fetchUsers();
        } catch (e) {
            if (axios.isAxiosError(e)) setCreateError(e.response?.data?.detail || "Failed to create user");
        } finally { setCreateLoading(false); }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
            await api.delete(`/admin/users/${id}`, { headers: authHeader() });
            fetchUsers(); fetchSessions();
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to delete user");
        }
    };

    const handleSetRole = async (id: number, role: Role) => {
        try {
            await api.patch(`/admin/users/${id}/role`, { role }, { headers: authHeader() });
            fetchUsers();
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to update role");
        }
    };

    const handleRevokeSession = async (id: number) => {
        try {
            await api.delete(`/admin/sessions/${id}`, { headers: authHeader() });
            fetchSessions(); fetchUsers();
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to revoke session");
        }
    };

    const [showSyncConfirm, setShowSyncConfirm] = useState(false);

    /** 칩으로 고른 학기 · 직접 입력한 학기 중 지금 유효한 것 */
    const targetTerm: TermRow | null = customTerm ?? syncTerm;

    const handleSync = async () => {
        if (!targetTerm) return;
        setShowSyncConfirm(false);
        setSyncLoading(true); setSyncResult(null);
        try {
            const res = await api.post(
                "/admin/sync",
                { year: targetTerm.year, semester: targetTerm.semester },
                { headers: authHeader() },
            );
            setSyncResult({
                ok: true,
                term: termLabel(res.data.term),
                ...res.data.stats,
                changed: res.data.changed,
                version: res.data.version,
                summary: res.data.summary,
            });
            // 새 학기를 처음 받았으면 목록에 없던 학기가 생깁니다
            fetchTerms();
            fetchBackups();
            setVersionTerm(targetTerm);
            fetchVersions(targetTerm);
        } catch (e) {
            if (axios.isAxiosError(e)) setSyncResult({ ok: false });
        } finally { setSyncLoading(false); }
    };

    const handleCreateBackup = async () => {
        setBackupBusy(true);
        try {
            await api.post("/admin/backups", {}, { headers: authHeader() });
            fetchBackups();
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to create backup");
        } finally { setBackupBusy(false); }
    };

    const toggle = (key: keyof typeof openSections) => {
        // Data Management: 탭별 첫 오픈 시 lazy fetch
        if (key === "data" && !openSections.data) {
            if (students.length === 0) fetchStudents();
            if (teachers.length === 0) fetchTeachers();
            if (subjects.length === 0) fetchSubjects();
        }
        if (key === "versions" && !openSections.versions && versions.length === 0) fetchVersions(versionTerm ?? targetTerm);
        if (key === "backups" && !openSections.backups && backups.length === 0) fetchBackups();
        if (key === "trade" && !openSections.trade && !trade) fetchTrade();
        if (key === "timetable" && !openSections.timetable) fetchOverrides();
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const saveOverride = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/admin/timetable-overrides", { date: overrideDate, source_day: overrideDay, title: overrideTitle }, { headers: authHeader() });
            setOverrideDate(""); setOverrideTitle("");
            fetchOverrides();
        } catch (err) {
            if (axios.isAxiosError(err)) setError(err.response?.data?.detail || "Failed to create timetable override");
        }
    };

    const deleteOverride = async (id: number) => {
        if (!confirm("이 대체시간표를 삭제하시겠습니까?")) return;
        try {
            await api.delete(`/admin/timetable-overrides/${id}`, { headers: authHeader() });
            fetchOverrides();
        } catch (err) {
            if (axios.isAxiosError(err)) setError(err.response?.data?.detail || "Failed to delete timetable override");
        }
    };

    const handleDataTabChange = (tab: DataTab) => {
        setDataTab(tab);
        setDataSearch("");
        setEditingStu(null); setEditingTeacher(null);
        if (tab === "students" && students.length === 0) fetchStudents();
        if (tab === "teachers" && teachers.length === 0) fetchTeachers();
        if (tab === "subjects" && subjects.length === 0) fetchSubjects();
    };

    const SIMPLE_PASSWORDS = ["12345", "123456", "1234567", "12345678", "password", "qwerty", "111111", "000000", "1234", "abc123", "pass"];

    const usernameWarning = (() => {
        if (!newUsername) return "";
        if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(newUsername)) return "한글은 username으로 사용할 수 없습니다";
        if (users.some((u) => u.username === newUsername)) return "이미 사용 중인 username입니다";
        return "";
    })();

    const passwordWarning = (() => {
        if (!newPassword) return "";
        if (newPassword.length < 5) return "비밀번호는 5자 이상이어야 합니다";
        if (new Set(newPassword).size === 1) return "너무 단순한 비밀번호입니다 (같은 문자 반복)";
        if (SIMPLE_PASSWORDS.includes(newPassword.toLowerCase())) return "너무 단순한 비밀번호입니다";
        return "";
    })();

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const q = dataSearch.toLowerCase();

    const filteredStudents = students.filter(
        (s) => !q || s.stuId.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
    const filteredTeachers = teachers.filter((t) => !q || t.name.toLowerCase().includes(q));
    const filteredSubjects = subjects.filter((s) => !q || s.subject.toLowerCase().includes(q));

    const termValid = !!targetTerm && targetTerm.year >= 2000 && targetTerm.year <= 2100;

    const syncBody = syncResult && (
        syncResult.ok ? (
            <span className="flex flex-wrap gap-3">
                {/* 바뀐 게 없으면 회차도 백업도 만들지 않습니다 —
                    "돌렸다" 와 "달라졌다" 는 다른 사건입니다 */}
                <span>{syncResult.changed ? "✓ Sync complete" : "= No changes"}</span>
                {syncResult.term && <span><strong>{syncResult.term}</strong></span>}
                {syncResult.version ? <span>v<strong>{syncResult.version}</strong></span> : null}
                <span>Synced <strong>{syncResult.synced}</strong></span>
                <span>Skipped <strong>{syncResult.skipped}</strong></span>
                {(syncResult.errors ?? 0) > 0 && <span>Errors <strong>{syncResult.errors}</strong></span>}
                <span className="opacity-60">{syncResult.elapsed}</span>
                {syncResult.backup && <span className="opacity-60">backup: {syncResult.backup}</span>}
            </span>
        ) : "Sync failed"
    );

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader title="Admin" subtitle="System" icon={Shield} />

            {/* Fetch 확인 모달 — 어느 학기를 덮어쓸지 여기서 고릅니다 */}
            <Modal
                open={showSyncConfirm}
                onClose={() => setShowSyncConfirm(false)}
                title="Fetch from KEIS"
                footer={
                    <>
                        <Button size="lg" variant="hairline" onClick={() => setShowSyncConfirm(false)}>
                            취소
                        </Button>
                        <Button size="lg" variant="filled" onClick={handleSync} disabled={!termValid}>
                            확인
                        </Button>
                    </>
                }
            >
                <div className="space-y-6">
                    <Text as="p" tone="secondary" leading="relaxed">
                        고른 학기의 수업 데이터를 KEIS API에서 다시 받아 <Text weight="black" tone="primary">통째로 교체</Text>합니다.
                        반영 직전 DB 스냅샷이 자동으로 남습니다.
                    </Text>

                    <div className="space-y-3">
                        <SectionTitle title="Term" />
                        <SegmentedControl
                            aria-label="받아올 학기"
                            value={customTerm ? "__custom" : syncTerm ? termLabel(syncTerm) : ""}
                            onChange={(value) => {
                                if (value === "__custom") {
                                    setCustomTerm(customTerm ?? { year: new Date().getFullYear(), semester: 1 });
                                    return;
                                }
                                const t = terms.find((row) => termLabel(row) === value);
                                if (t) { setSyncTerm(t); setCustomTerm(null); }
                            }}
                            options={[
                                ...terms.map((t) => ({ value: termLabel(t), label: termLabel(t) })),
                                { value: "__custom", label: "새 학기" },
                            ]}
                        />

                        {/* DB에 아직 없는 학기 — 새 학기를 처음 채울 때 씁니다 */}
                        {customTerm && (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    size="sm"
                                    value={customTerm.year}
                                    min={2000}
                                    max={2100}
                                    onChange={(e) => setCustomTerm({ ...customTerm, year: Number(e.target.value) })}
                                    className="w-24"
                                />
                                <Text weight="black" tone="muted">-</Text>
                                <SegmentedControl
                                    aria-label="학기"
                                    value={String(customTerm.semester)}
                                    onChange={(value) => setCustomTerm({ ...customTerm, semester: Number(value) })}
                                    options={[1, 2].map((sem) => ({ value: String(sem), label: `${sem}학기` }))}
                                />
                            </div>
                        )}

                        <Text as="p" variant="caption" tone="muted">
                            {termValid && targetTerm
                                ? `${termLabel(targetTerm)} 학기를 받아옵니다. 완료까지 몇 분 이상 걸릴 수 있습니다.`
                                : "받아올 학기를 고르세요."}
                        </Text>
                    </div>
                </div>
            </Modal>

            {error && (
                <Notice
                    role="alert"
                    action={<Button size="xs" accent="error" variant="outline" onClick={() => setError("")}>닫기</Button>}
                >
                    {error}
                </Notice>
            )}

            {/* Users */}
            <Accordion titleStyle="section" title="Material Review" icon={FileCheck2} open={openSections.materials} onOpenChange={() => toggle("materials")}>
                <MaterialReviewPanel />
            </Accordion>

            {/* Ask 의 기억 — ksain 글에서 뽑은 사실. 자료 검수처럼 사람이 걸러 내는 자리라 그 옆에 둡니다.
                열 때마다 패널이 새로 받습니다(접으면 내려갑니다) */}
            <Accordion titleStyle="section" title="Ask Memory" icon={Brain} open={openSections.memory} onOpenChange={() => toggle("memory")}>
                <FactsPanel />
            </Accordion>

            <Accordion titleStyle="section" title="User Management" icon={Users} open={openSections.users} onOpenChange={() => toggle("users")}>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <SectionTitle title="Accounts" />
                        <div className="space-y-2">
                            {users.map((u) => (
                                <Card shadow="raised" key={u.id} padding="0" className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                                    <Text weight="black" truncate className="flex-1 min-w-0">{u.username}</Text>
                                    {u.demo_stu_id && (
                                        <Badge
                                            size="sm"
                                            accent="orange"
                                            variant="outline"
                                            className="shrink-0"
                                            title={`${u.demo_stu_id} 으로 보이는 시연 계정입니다`}
                                        >
                                            Demo {u.demo_stu_id}
                                        </Badge>
                                    )}
                                    <Text variant="micro" tone="muted" className="shrink-0">
                                        {u.session_count > 0 ? "● ONLINE" : "○ OFFLINE"}
                                    </Text>
                                    {/* 좁은 화면에서는 한 줄을 통째로 씁니다 — 한 줄에 다 넣으면
                                        아이디가 잘리거나 지우기 버튼이 카드 밖으로 나갑니다 */}
                                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                                        <SegmentedControl
                                            attached
                                            size="xs"
                                            aria-label={`${u.username} 권한`}
                                            value={u.role}
                                            onChange={(role) => handleSetRole(u.id, role)}
                                            options={ROLE_OPTIONS}
                                        />
                                        <IconButton icon={Trash2} size="sm" accent="error" label="계정 삭제" onClick={() => handleDeleteUser(u.id)} className="shrink-0" />
                                    </div>
                                </Card>
                            ))}
                            {users.length === 0 && <Text as="p" tone="muted">No users found.</Text>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <SectionTitle title="Create User" icon={Plus} />
                        <form onSubmit={handleCreateUser} className="space-y-3">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="flex-1 space-y-1">
                                    <Input
                                        type="text"
                                        shadow
                                        placeholder="Username"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        warning={!!usernameWarning}
                                        required
                                    />
                                    {usernameWarning && (
                                        <Text as="p" variant="caption" tone="warning">⚠ {usernameWarning}</Text>
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <Input
                                        type="password"
                                        shadow
                                        placeholder="Password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        warning={!!passwordWarning}
                                        required
                                    />
                                    {passwordWarning && (
                                        <Text as="p" variant="caption" tone="warning">⚠ {passwordWarning}</Text>
                                    )}
                                </div>
                            </div>
                            {/* 시연 계정 — 학교 구글 계정이 없는 사람에게 주는 통로입니다.
                                누구로 보일지는 여기서 정해지고, 고를 수 있는 건 본인뿐입니다 */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    size="xs"
                                    accent="orange"
                                    variant="muted"
                                    selected={newDemo}
                                    icon={FlaskConical}
                                    onClick={() => setNewDemo((v) => !v)}
                                    disabled={!myStuId}
                                    className="shrink-0"
                                >
                                    Demo
                                </Button>
                                <Text variant="caption" tone="muted" className="min-w-0 flex-1">
                                    {!myStuId
                                        ? "내 계정에 학번이 등록되어 있어야 만들 수 있습니다."
                                        : newDemo
                                          ? `구글 연동 없이 바로 들어오고, ${demoLabel}${particleRo(demoLabel)} 보입니다.`
                                          : "학교 구글 계정 없이 쓸 계정이면 켜세요."}
                                </Text>
                            </div>
                            <div className="flex items-center justify-between">
                                <SegmentedControl
                                    attached
                                    size="xs"
                                    aria-label="새 계정 권한"
                                    value={newRole}
                                    onChange={setNewRole}
                                    options={ROLE_OPTIONS}
                                />
                                <Button type="submit" variant="filled" shadow size="sm" disabled={createLoading}>
                                    {createLoading ? "..." : "Create"}
                                </Button>
                            </div>
                            {createError && <Text as="p" variant="caption" tone="error">{createError}</Text>}
                        </form>
                    </div>
                </div>
            </Accordion>

            {/* 전공 조사 — 묻는 창에 얼마나 답했는지. 인원 수만 옵니다(누가 무엇을 골랐는지는 서버도 안 보냅니다) */}
            <Accordion titleStyle="section" title="Major Survey" icon={Signpost} open={openSections.survey} onOpenChange={() => toggle("survey")}>
                <MajorSurveyPanel />
            </Accordion>

            {/* Sessions */}
            <Accordion titleStyle="section" title="Active Sessions" icon={MonitorSmartphone} open={openSections.sessions} onOpenChange={() => toggle("sessions")}>
                <div className="space-y-2">
                    <SectionTitle
                        title={`${sessions.length} Session${sessions.length !== 1 ? "s" : ""}`}
                        trailing={
                            <IconButton icon={RefreshCw} size="sm" label="새로고침" onClick={() => { fetchSessions(); fetchUsers(); }} />
                        }
                    />
                    <div className="space-y-2">
                        {sessions.map((s) => (
                            <Card shadow="raised" key={s.id} padding="0" className="flex items-start gap-3 px-4 py-3">
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Text weight="black">{s.username}</Text>
                                        <Badge size="sm" variant="hairline">{s.device_type}</Badge>
                                    </div>
                                    <Text as="div" variant="micro" weight="bold" tone="muted" className="space-y-0.5">
                                        <p>IP: {s.ip_address ?? "Unknown"}</p>
                                        <p>Last used: {formatDate(s.last_used_at)}</p>
                                        <p>Expires: {formatDate(s.expires_at)}</p>
                                    </Text>
                                </div>
                                <IconButton icon={Trash2} size="sm" accent="error" label="세션 폐기" onClick={() => handleRevokeSession(s.id)} className="shrink-0" />
                            </Card>
                        ))}
                        {sessions.length === 0 && <Text as="p" tone="muted">No active sessions.</Text>}
                    </div>
                </div>
            </Accordion>

            {/* Data Management (+ Sync 통합) */}
            <Accordion titleStyle="section" title="Data Management" icon={GraduationCap} open={openSections.data} onOpenChange={() => toggle("data")}>
                <div className="space-y-4">
                    {/* 탭 + Refresh / Sync 버튼 */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <SegmentedControl
                            aria-label="데이터 종류"
                            value={dataTab}
                            onChange={handleDataTabChange}
                            options={[
                                { value: "students", label: "Students" },
                                { value: "teachers", label: "Teachers" },
                                { value: "subjects", label: "Subjects" },
                            ]}
                        />
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                size="xs"
                                variant="muted"
                                icon={RefreshCw}
                                onClick={() => {
                                    if (dataTab === "students") fetchStudents();
                                    else if (dataTab === "teachers") fetchTeachers();
                                    else fetchSubjects();
                                }}
                            >
                                Refetch
                            </Button>
                            <Button
                                size="xs"
                                variant="filled"
                                icon={RefreshCw}
                                iconSpin={syncLoading}
                                onClick={() => setShowSyncConfirm(true)}
                                disabled={syncLoading}
                            >
                                {syncLoading ? "Fetching..." : "Fetch from KEIS"}
                            </Button>
                        </div>
                    </div>

                    {syncResult && (
                        !syncResult.ok || syncResult.changed ? (
                            <Notice accent={syncResult.ok ? "success" : "error"}>{syncBody}</Notice>
                        ) : (
                            <Surface fill="well" border="soft" className="px-3 py-2">
                                <Text variant="caption" tone="secondary">{syncBody}</Text>
                            </Surface>
                        )
                    )}

                    {syncResult?.ok && syncResult.summary && (
                        <Surface border="line" className="px-3 py-3">
                            <ChangeSummary data={syncResult.summary} />
                        </Surface>
                    )}

                    {/* 검색 */}
                    <Input
                        type="text"
                        shadow
                        placeholder={
                            dataTab === "students" ? "학번 또는 이름으로 필터..."
                            : dataTab === "teachers" ? "교사명으로 필터..."
                            : "과목명으로 필터..."
                        }
                        value={dataSearch}
                        onChange={(e) => setDataSearch(e.target.value)}
                    />

                    {/* 리스트 */}
                    <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">

                        {/* ── Students ── */}
                        {dataTab === "students" && (
                            <>
                                {filteredStudents.map((s) => (
                                    <EditableRow
                                        key={s.stuId}
                                        label={s.name}
                                        sub={s.stuId}
                                        isEditing={editingStu === s.stuId}
                                        editValue={stuEditVal}
                                        onEditValueChange={setStuEditVal}
                                        onStartEdit={() => { setEditingStu(s.stuId); setStuEditVal(s.name); }}
                                        onSave={() => handleSaveStu(s.stuId)}
                                        onCancel={() => setEditingStu(null)}
                                        saving={stuSaving}
                                        placeholder="이름 입력..."
                                    />
                                ))}
                                {filteredStudents.length === 0 && (
                                    <Text as="p" tone="muted">No students found.</Text>
                                )}
                            </>
                        )}

                        {/* ── Teachers ── */}
                        {dataTab === "teachers" && (
                            <>
                                {filteredTeachers.map((t) => (
                                    <EditableRow
                                        key={t.name}
                                        label={t.name}
                                        sub={`${t.section_count}개 분반`}
                                        isEditing={editingTeacher === t.name}
                                        editValue={teacherEditVal}
                                        onEditValueChange={setTeacherEditVal}
                                        onStartEdit={() => { setEditingTeacher(t.name); setTeacherEditVal(t.name); }}
                                        onSave={() => handleSaveTeacher(t.name)}
                                        onCancel={() => setEditingTeacher(null)}
                                        saving={teacherSaving}
                                        placeholder="새 이름 입력..."
                                    />
                                ))}
                                {filteredTeachers.length === 0 && (
                                    <Text as="p" tone="muted">No teachers found.</Text>
                                )}
                            </>
                        )}

                        {/* ── Subjects ── */}
                        {dataTab === "subjects" && (
                            <>
                                <Text as="p" variant="caption" tone="muted">
                                    교육과정에 이어지지 않은 과목은 학점·계열을 알 수 없습니다.
                                    외국인 전형 과목이나 개편 전 이름이 여기 해당합니다.
                                </Text>
                                {filteredSubjects.map((s) => (
                                    <Surface
                                        key={s.subject}
                                        fill="none"
                                        border="subtle"
                                        borderSide="bottom"
                                        className="flex flex-wrap items-center gap-2 py-2"
                                    >
                                        <Text weight="black" className="flex-1 min-w-[10rem]">
                                            {s.subject}
                                        </Text>
                                        {s.english && (
                                            <Text variant="micro" weight="bold" tone="muted">
                                                {s.english}
                                            </Text>
                                        )}
                                        {s.course ? (
                                            <Badge size="sm" accent="green" variant="tinted">
                                                {s.course}
                                            </Badge>
                                        ) : (
                                            <Badge size="sm" accent="orange" variant="plain">
                                                교육과정 없음
                                            </Badge>
                                        )}
                                    </Surface>
                                ))}
                                {filteredSubjects.length === 0 && (
                                    <Text as="p" tone="muted">No subjects found.</Text>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </Accordion>

            {/* Backups — 수집 직전 스냅샷이 쌓이는 곳. 자동 삭제 없음 */}
            {/* 회차 이력 — 언제 무엇이 갈렸는지. 백업 파일을 열어 보지 않아도 됩니다 */}
            <Accordion titleStyle="section" title="Data Versions" icon={History} open={openSections.versions} onOpenChange={() => toggle("versions")}>
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <SegmentedControl
                            aria-label="회차를 볼 학기"
                            value={versionTerm ? termLabel(versionTerm) : ""}
                            onChange={(value) => {
                                const t = terms.find((row) => termLabel(row) === value);
                                if (!t) return;
                                setVersionTerm(t);
                                setOpenVersion(null);
                                fetchVersions(t);
                            }}
                            options={terms.map((t) => ({ value: termLabel(t), label: termLabel(t) }))}
                        />
                        <Button
                            size="xs"
                            variant="muted"
                            icon={RefreshCw}
                            onClick={() => fetchVersions(versionTerm ?? targetTerm)}
                        >
                            Refetch
                        </Button>
                    </div>

                    {versions.length === 0 ? (
                        <Text as="p" variant="caption" tone="muted">회차 기록이 없습니다.</Text>
                    ) : (
                        <ul className="space-y-2">
                            {versions.map((row) => (
                                <li key={row.version}>
                                    <Accordion
                                        size="sm"
                                        open={openVersion === row.version}
                                        onOpenChange={() => setOpenVersion(openVersion === row.version ? null : row.version)}
                                        title={
                                            <span className="inline-flex items-center gap-2">
                                                <span>v{row.version}</span>
                                                <Badge size="sm" variant="hairline">{row.source}</Badge>
                                                <Text variant="caption" tone="secondary">{formatWhen(row.created_at)}</Text>
                                            </span>
                                        }
                                        trailing={
                                            <Text variant="caption" tone="muted" className="shrink-0">{versionHeadline(row)}</Text>
                                        }
                                    >
                                        <div className="space-y-2">
                                            {row.note && <Text as="p" variant="caption" tone="secondary">{row.note}</Text>}
                                            {row.summary ? (
                                                <ChangeSummary data={row.summary} />
                                            ) : (
                                                <Text as="p" variant="caption" tone="muted">
                                                    비교할 앞 회차가 없습니다.
                                                </Text>
                                            )}
                                            <Text as="div" variant="micro" weight="bold" tone="muted" className="flex flex-wrap gap-3">
                                                {row.synced !== null && <span>synced {row.synced}</span>}
                                                {row.skipped !== null && <span>skipped {row.skipped}</span>}
                                                {!!row.errors && <span>errors {row.errors}</span>}
                                                {row.elapsed && <span>{row.elapsed}</span>}
                                                {row.backup && <span className="truncate">backup: {row.backup}</span>}
                                            </Text>
                                        </div>
                                    </Accordion>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Accordion>

            {/* Trade — 수강 변경 탐색을 언제까지 열어 둘지 */}
            <Accordion titleStyle="section" title="Timetable Overrides" icon={CalendarDays} open={openSections.timetable} onOpenChange={() => toggle("timetable")}>
                <div className="space-y-4">
                    <Text as="p" variant="caption" tone="secondary">특정 날짜에 선택한 요일의 정규 시간표를 적용합니다. 날짜마다 한 이벤트만 등록할 수 있습니다.</Text>
                    <form onSubmit={saveOverride} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                        <Label className="block space-y-1.5">날짜<Input required type="date" size="sm" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} /></Label>
                        <Label className="block space-y-1.5">가져올 시간표<Select size="sm" value={overrideDay} onChange={(e) => setOverrideDay(e.target.value)}>{WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></Label>
                        <Label className="block space-y-1.5">이벤트 이름<Input required size="sm" maxLength={100} value={overrideTitle} onChange={(e) => setOverrideTitle(e.target.value)} placeholder="월요일 시간표 운영" /></Label>
                        <Button size="lg" type="submit" variant="filled" icon={Plus} className="justify-center">Create</Button>
                    </form>
                    <div className="space-y-2">
                        {overrides.map((event) => <Card shadow="raised" key={event.id} padding="0" className="flex items-center justify-between gap-3 px-3 py-2"><div><Text as="div" weight="black">{event.date} · {event.title}</Text><Text variant="caption" tone="muted">{WEEKDAYS.find((d) => d.value === event.source_day)?.label ?? event.source_day} 시간표</Text></div><IconButton icon={Trash2} accent="error" label="대체시간표 삭제" onClick={() => deleteOverride(event.id)} /></Card>)}
                        {overrides.length === 0 && <Text as="p" tone="muted">등록된 대체시간표 이벤트가 없습니다.</Text>}
                    </div>
                </div>
            </Accordion>

            <Accordion titleStyle="section" title="Trade" icon={ArrowLeftRight} open={openSections.trade} onOpenChange={() => toggle("trade")}>
                {trade === null ? (
                    <Text as="p" tone="muted">불러오는 중…</Text>
                ) : (
                    <div className="space-y-5">
                        {/* 지금 어떤 상태인지부터. 켜고 끄는 값들이 아래 있어도,
                            결과는 스위치·마감·서버 시각이 함께 정합니다 */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            {trade.open ? (
                                <Badge accent="green" variant="solid">열림</Badge>
                            ) : (
                                <Badge variant="wash">닫힘</Badge>
                            )}
                            <Text variant="caption" tone="muted">
                                {trade.enabled
                                    ? `${kstLabel(trade.until)} 까지`
                                    : "스위치가 내려가 있습니다"}
                            </Text>
                        </div>

                        <Text as="p" variant="caption" tone="muted" leading="relaxed">
                            홈 배너, 하단 네비·사이드바 메뉴, <Code>/trade</Code> 주소, 홈의
                            «기존 시간표 | 트레이드 계획» 전환이 <b>전부 이 설정 하나로</b>{" "}
                            갈립니다. 열려 있는지는 <b>서버 시계</b>가 정합니다 — 보는 기기의
                            시계가 틀어져 있어도 같은 때에 닫힙니다.
                        </Text>

                        {/* 스위치 */}
                        <div className="space-y-2">
                            <SectionTitle title="On / Off" />
                            <div className="flex flex-wrap items-center gap-3">
                                <SegmentedControl
                                    attached
                                    size="xs"
                                    aria-label="Trade 스위치"
                                    value={trade.enabled ? "on" : "off"}
                                    onChange={(value) => saveTrade({ enabled: value === "on" })}
                                    options={[
                                        { value: "on", label: "켜짐", disabled: tradeBusy },
                                        { value: "off", label: "꺼짐", disabled: tradeBusy },
                                    ]}
                                />
                                <Text variant="caption" tone="muted">
                                    기간과 무관하게 지금 내리고 싶을 때
                                </Text>
                            </div>
                        </div>

                        {/* 마감 */}
                        <div className="space-y-2">
                            <SectionTitle title="Deadline" />
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    type="datetime-local"
                                    shadow
                                    value={toLocalInput(trade.until)}
                                    disabled={tradeBusy}
                                    onChange={(e) =>
                                        saveTrade({ until: fromLocalInput(e.target.value) })
                                    }
                                    className="w-auto"
                                />
                                <Button
                                    size="sm"
                                    variant="paper"
                                    shadow
                                    disabled={tradeBusy || !trade.until}
                                    onClick={() => saveTrade({ until: null })}
                                >
                                    기한 없음
                                </Button>
                            </div>
                            <Text as="p" variant="caption" tone="muted">
                                입력칸은 <b>이 브라우저의 시간대</b>로 보입니다. 저장되는 값은{" "}
                                <b>{kstLabel(trade.until)}</b> (서울) 입니다.
                            </Text>
                        </div>

                        {/* 학기 */}
                        <div className="space-y-2">
                            <SectionTitle title="Term" />
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    type="number"
                                    shadow
                                    value={trade.year ?? ""}
                                    disabled={tradeBusy}
                                    onChange={(e) => {
                                        const year = Number(e.target.value);
                                        if (year >= 2000 && year <= 2100) saveTrade({ year });
                                    }}
                                    className="w-24"
                                />
                                <SegmentedControl
                                    attached
                                    size="xs"
                                    aria-label="Trade 학기"
                                    value={trade.semester === null ? "" : String(trade.semester)}
                                    onChange={(value) => saveTrade({ semester: Number(value) })}
                                    options={[1, 2].map((sem) => ({ value: String(sem), label: `${sem}학기`, disabled: tradeBusy }))}
                                />
                                <Text variant="caption" tone="muted">
                                    이 학기를 보고 있는 사람에게만 뜹니다
                                </Text>
                            </div>
                        </div>

                        {tradeError && (
                            <Text as="p" variant="caption" tone="error">{tradeError}</Text>
                        )}
                    </div>
                )}
            </Accordion>

            <Accordion titleStyle="section" title="Backups" icon={Archive} open={openSections.backups} onOpenChange={() => toggle("backups")}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Text as="p" variant="caption" tone="muted">
                            수집 직전에 자동으로 남습니다. 지워지지 않으니 총 {formatBytes(backupTotal)} — 커지면 서버에서 직접 정리하세요.
                        </Text>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button size="xs" variant="muted" icon={RefreshCw} onClick={fetchBackups}>
                                Refetch
                            </Button>
                            <Button size="xs" variant="filled" icon={Camera} onClick={handleCreateBackup} disabled={backupBusy}>
                                {backupBusy ? "Saving..." : "Snapshot"}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                        {backups.map((b) => (
                            <Card shadow="raised"
                                key={b.name}
                                padding="0"
                                className="px-4 py-3 flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0">
                                    <Text as="div" weight="black">{b.created}</Text>
                                    <Text as="div" variant="micro" weight="bold" tone="muted" truncate>{b.name}</Text>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {b.label && (
                                        <Badge size="sm" variant="hairline">
                                            {b.label}
                                        </Badge>
                                    )}
                                    <Text variant="micro" weight="bold" tone="muted">{formatBytes(b.bytes)}</Text>
                                </div>
                            </Card>
                        ))}
                        {backups.length === 0 && <Text as="p" tone="muted">No backups yet.</Text>}
                    </div>
                </div>
            </Accordion>
        </div>
    );
};

export default AdminPage;
