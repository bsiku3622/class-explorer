import React, { useState, useEffect, useCallback } from "react";
import { Shield, Users, MonitorSmartphone, RefreshCw, Trash2, Plus, X, Check, GraduationCap, Archive, Camera, History } from "lucide-react";
import api from "../lib/api";
import { authHeader } from "../lib/session";
import axios from "axios";
import type { Role } from "../types";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import AccordionSection from "../components/molecules/AccordionSection";
import PageHeader from "../components/molecules/PageHeader";
import ChangeSummary from "../components/admin/ChangeSummary";
import type { ChangeSummaryData } from "../components/admin/ChangeSummary";

interface UserRow {
    id: number;
    username: string;
    role: Role;
    session_count: number;
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
    const inputClass =
        "border-2 border-black px-3 py-2 text-sm font-bold bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] focus:shadow-none outline-none transition-all duration-100";

    return (
        <div className="border-2 border-black bg-white px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <span className="font-black text-sm truncate block">{label}</span>
                    {sub && <span className="text-[10px] font-bold text-black/40">{sub}</span>}
                </div>
                {!isEditing && (
                    <button
                        onClick={onStartEdit}
                        className="text-[10px] font-black uppercase px-2 py-1 border-2 border-black/30 hover:border-black hover:text-black text-black/40 shrink-0 transition-all duration-100"
                    >
                        Edit
                    </button>
                )}
            </div>
            {isEditing ? (
                <div className="mt-2 flex gap-2 items-center">
                    <input
                        autoFocus
                        type="text"
                        value={editValue}
                        onChange={(e) => onEditValueChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) onSave();
                            if (e.key === "Escape") onCancel();
                        }}
                        placeholder={placeholder}
                        className={inputClass + " flex-1 text-xs"}
                    />
                    <button onClick={onSave} disabled={saving} className="text-green-600 hover:text-green-800 transition-colors shrink-0">
                        <Check size={16} strokeWidth={2.5} />
                    </button>
                    <button onClick={onCancel} className="text-black/40 hover:text-black transition-colors shrink-0">
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>
            ) : (
                children && <div className="mt-1.5">{children}</div>
            )}
        </div>
    );
};

const AdminPage: React.FC = () => {
    const [openSections, setOpenSections] = useState({ users: true, sessions: true, data: false, versions: false, backups: false });

    // Users
    const [users, setUsers] = useState<UserRow[]>([]);
    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState<Role>("user");
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
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError("");
        setCreateLoading(true);
        try {
            await api.post("/admin/users", { username: newUsername, password: newPassword, role: newRole }, { headers: authHeader() });
            setNewUsername(""); setNewPassword(""); setNewRole("user");
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
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDataTabChange = (tab: DataTab) => {
        setDataTab(tab);
        setDataSearch("");
        setEditingStu(null); setEditingTeacher(null);
        if (tab === "students" && students.length === 0) fetchStudents();
        if (tab === "teachers" && teachers.length === 0) fetchTeachers();
        if (tab === "subjects" && subjects.length === 0) fetchSubjects();
    };

    const inputClass =
        "border-2 border-black px-3 py-2 text-sm font-bold bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] focus:shadow-none outline-none transition-all duration-100";

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

    const chipClass = (active: boolean) =>
        `text-xs font-black uppercase px-3 py-1.5 border-2 transition-all duration-100 ${
            active
                ? "bg-black text-white border-black"
                : "border-black/30 text-black/50 hover:border-black hover:text-black"
        }`;

    const termValid = !!targetTerm && targetTerm.year >= 2000 && targetTerm.year <= 2100;

    const dataTabBtn = (tab: DataTab, label: string) => (
        <button
            onClick={() => handleDataTabChange(tab)}
            className={`text-xs font-black uppercase px-3 py-1.5 border-2 transition-all duration-100 ${
                dataTab === tab
                    ? "bg-black text-white border-black"
                    : "border-black/30 text-black/50 hover:border-black hover:text-black"
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-20">
            <PageHeader title="Admin" subtitle="System" icon={Shield} />

            {/* Fetch 확인 모달 — 어느 학기를 덮어쓸지 여기서 고릅니다 */}
            {showSyncConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,0.3)] p-8 max-w-md w-full mx-4 space-y-6">
                        <div className="space-y-2">
                            <p className="text-sm font-black uppercase tracking-widest">Fetch from KEIS</p>
                            <p className="text-sm font-bold text-black/60 leading-relaxed">
                                고른 학기의 수업 데이터를 KEIS API에서 다시 받아 <span className="text-black font-black">통째로 교체</span>합니다.
                                반영 직전 DB 스냅샷이 자동으로 남습니다.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <RetroSubTitle title="Term" />
                            <div className="flex flex-wrap gap-2">
                                {terms.map((t) => (
                                    <button
                                        key={termLabel(t)}
                                        onClick={() => { setSyncTerm(t); setCustomTerm(null); }}
                                        className={chipClass(!customTerm && !!syncTerm && termLabel(syncTerm) === termLabel(t))}
                                    >
                                        {termLabel(t)}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCustomTerm(customTerm ?? { year: new Date().getFullYear(), semester: 1 })}
                                    className={chipClass(!!customTerm)}
                                >
                                    새 학기
                                </button>
                            </div>

                            {/* DB에 아직 없는 학기 — 새 학기를 처음 채울 때 씁니다 */}
                            {customTerm && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={customTerm.year}
                                        min={2000}
                                        max={2100}
                                        onChange={(e) => setCustomTerm({ ...customTerm, year: Number(e.target.value) })}
                                        className={inputClass + " w-24 text-xs"}
                                    />
                                    <span className="text-sm font-black text-black/40">-</span>
                                    {[1, 2].map((sem) => (
                                        <button
                                            key={sem}
                                            onClick={() => setCustomTerm({ ...customTerm, semester: sem })}
                                            className={chipClass(customTerm.semester === sem)}
                                        >
                                            {sem}학기
                                        </button>
                                    ))}
                                </div>
                            )}

                            <p className="text-xs font-bold text-black/40">
                                {termValid && targetTerm
                                    ? `${termLabel(targetTerm)} 학기를 받아옵니다. 완료까지 몇 분 이상 걸릴 수 있습니다.`
                                    : "받아올 학기를 고르세요."}
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowSyncConfirm(false)}
                                className="text-xs font-black uppercase px-4 py-2 border-2 border-black/30 hover:border-black transition-all duration-100"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSync}
                                disabled={!termValid}
                                className="text-xs font-black uppercase px-4 py-2 border-2 border-black bg-black text-white hover:bg-black/80 disabled:opacity-40 transition-all duration-100"
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <p className="text-xs font-bold text-red-600 border-2 border-red-500 px-4 py-2 bg-red-50">
                    {error}
                    <button className="ml-2 underline" onClick={() => setError("")}>닫기</button>
                </p>
            )}

            {/* Users */}
            <AccordionSection title="User Management" icon={Users} isOpen={openSections.users} onToggle={() => toggle("users")}>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <RetroSubTitle title="Accounts" />
                        <div className="space-y-2">
                            {users.map((u) => (
                                <div key={u.id} className="flex items-center gap-3 border-2 border-black bg-white px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
                                    <span className="font-black text-sm flex-1">{u.username}</span>
                                    <span className="text-[10px] font-black text-black/40 uppercase">
                                        {u.session_count > 0 ? "● ONLINE" : "○ OFFLINE"}
                                    </span>
                                    <div className="flex">
                                        {ROLE_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => handleSetRole(u.id, opt.value)}
                                                className={`text-[10px] font-black uppercase px-2 py-1 border-2 -ml-0.5 first:ml-0 transition-all duration-100 ${
                                                    u.role === opt.value
                                                        ? "bg-black text-white border-black relative z-10"
                                                        : "bg-white text-black/40 border-black/30 hover:border-black hover:text-black"
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 transition-colors">
                                        <Trash2 size={15} strokeWidth={2.5} />
                                    </button>
                                </div>
                            ))}
                            {users.length === 0 && <p className="text-sm font-bold text-black/40">No users found.</p>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <RetroSubTitle title="Create User" icon={Plus} />
                        <form onSubmit={handleCreateUser} className="space-y-3">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="flex-1 space-y-1">
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        className={`${inputClass} w-full ${usernameWarning ? "border-orange-400" : ""}`}
                                        required
                                    />
                                    {usernameWarning && (
                                        <p className="text-[11px] font-bold text-orange-600">⚠ {usernameWarning}</p>
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className={`${inputClass} w-full ${passwordWarning ? "border-orange-400" : ""}`}
                                        required
                                    />
                                    {passwordWarning && (
                                        <p className="text-[11px] font-bold text-orange-600">⚠ {passwordWarning}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex">
                                    {ROLE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setNewRole(opt.value)}
                                            className={`text-[10px] font-black uppercase px-2.5 py-1.5 border-2 -ml-0.5 first:ml-0 transition-all duration-100 ${
                                                newRole === opt.value
                                                    ? "bg-black text-white border-black relative z-10"
                                                    : "bg-white text-black/40 border-black/30 hover:border-black hover:text-black"
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <RetroButton type="submit" variant="black" size="sm" disabled={createLoading}>
                                    {createLoading ? "..." : "Create"}
                                </RetroButton>
                            </div>
                            {createError && <p className="text-xs font-bold text-red-600">{createError}</p>}
                        </form>
                    </div>
                </div>
            </AccordionSection>

            {/* Sessions */}
            <AccordionSection title="Active Sessions" icon={MonitorSmartphone} isOpen={openSections.sessions} onToggle={() => toggle("sessions")}>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <RetroSubTitle title={`${sessions.length} Session${sessions.length !== 1 ? "s" : ""}`} />
                        <button onClick={() => { fetchSessions(); fetchUsers(); }} className="text-black/40 hover:text-black transition-colors">
                            <RefreshCw size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {sessions.map((s) => (
                            <div key={s.id} className="border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] px-4 py-3 flex items-start gap-3">
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-sm">{s.username}</span>
                                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 border border-black/30 text-black/50">{s.device_type}</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-black/40 space-y-0.5">
                                        <p>IP: {s.ip_address ?? "Unknown"}</p>
                                        <p>Last used: {formatDate(s.last_used_at)}</p>
                                        <p>Expires: {formatDate(s.expires_at)}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleRevokeSession(s.id)} className="text-red-500 hover:text-red-700 transition-colors shrink-0 mt-0.5">
                                    <Trash2 size={15} strokeWidth={2.5} />
                                </button>
                            </div>
                        ))}
                        {sessions.length === 0 && <p className="text-sm font-bold text-black/40">No active sessions.</p>}
                    </div>
                </div>
            </AccordionSection>

            {/* Data Management (+ Sync 통합) */}
            <AccordionSection title="Data Management" icon={GraduationCap} isOpen={openSections.data} onToggle={() => toggle("data")}>
                <div className="space-y-4">
                    {/* 탭 + Refresh / Sync 버튼 */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-2">
                            {dataTabBtn("students", "Students")}
                            {dataTabBtn("teachers", "Teachers")}
                            {dataTabBtn("subjects", "Subjects")}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => {
                                    if (dataTab === "students") fetchStudents();
                                    else if (dataTab === "teachers") fetchTeachers();
                                    else fetchSubjects();
                                }}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1.5 border-2 border-black/30 text-black/50 hover:border-black hover:text-black transition-all duration-100"
                            >
                                <RefreshCw size={11} strokeWidth={2.5} />
                                Refetch
                            </button>
                            <button
                                onClick={() => setShowSyncConfirm(true)}
                                disabled={syncLoading}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1.5 border-2 border-black bg-black text-white hover:bg-black/80 transition-all duration-100 disabled:opacity-50"
                            >
                                <RefreshCw size={11} strokeWidth={2.5} className={syncLoading ? "animate-spin" : ""} />
                                {syncLoading ? "Fetching..." : "Fetch from KEIS"}
                            </button>
                        </div>
                    </div>

                    {syncResult && (
                        <div className={`border-2 px-3 py-2 text-xs font-bold ${
                            !syncResult.ok ? "border-red-500 bg-red-50 text-red-600"
                            : syncResult.changed ? "border-green-600 bg-green-50 text-green-700"
                            : "border-black/30 bg-black/[0.03] text-black/60"
                        }`}>
                            {syncResult.ok ? (
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
                            ) : "Sync failed"}
                        </div>
                    )}

                    {syncResult?.ok && syncResult.summary && (
                        <div className="border-2 border-black bg-white px-3 py-3">
                            <ChangeSummary data={syncResult.summary} />
                        </div>
                    )}

                    {/* 검색 */}
                    <input
                        type="text"
                        placeholder={
                            dataTab === "students" ? "학번 또는 이름으로 필터..."
                            : dataTab === "teachers" ? "교사명으로 필터..."
                            : "과목명으로 필터..."
                        }
                        value={dataSearch}
                        onChange={(e) => setDataSearch(e.target.value)}
                        className={inputClass + " w-full"}
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
                                    <p className="text-sm font-bold text-black/40">No students found.</p>
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
                                    <p className="text-sm font-bold text-black/40">No teachers found.</p>
                                )}
                            </>
                        )}

                        {/* ── Subjects ── */}
                        {dataTab === "subjects" && (
                            <>
                                <p className="text-xs font-bold text-black/40">
                                    교육과정에 이어지지 않은 과목은 학점·계열을 알 수 없습니다.
                                    외국인 전형 과목이나 개편 전 이름이 여기 해당합니다.
                                </p>
                                {filteredSubjects.map((s) => (
                                    <div
                                        key={s.subject}
                                        className="flex flex-wrap items-center gap-2 border-b-2 border-black/10 py-2"
                                    >
                                        <span className="text-sm font-black flex-1 min-w-[10rem]">
                                            {s.subject}
                                        </span>
                                        {s.english && (
                                            <span className="text-[10px] font-bold text-black/40">
                                                {s.english}
                                            </span>
                                        )}
                                        {s.course ? (
                                            <span className="border-2 border-retro-green bg-retro-green/15 px-1.5 py-0.5 text-[10px] font-black">
                                                {s.course}
                                            </span>
                                        ) : (
                                            <span className="border-2 border-retro-accent4 bg-retro-accent4/15 px-1.5 py-0.5 text-[10px] font-black text-retro-accent4">
                                                교육과정 없음
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {filteredSubjects.length === 0 && (
                                    <p className="text-sm font-bold text-black/40">No subjects found.</p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </AccordionSection>

            {/* Backups — 수집 직전 스냅샷이 쌓이는 곳. 자동 삭제 없음 */}
            {/* 회차 이력 — 언제 무엇이 갈렸는지. 백업 파일을 열어 보지 않아도 됩니다 */}
            <AccordionSection title="Data Versions" icon={History} isOpen={openSections.versions} onToggle={() => toggle("versions")}>
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            {terms.map((t) => (
                                <button
                                    key={termLabel(t)}
                                    onClick={() => {
                                        setVersionTerm(t);
                                        setOpenVersion(null);
                                        fetchVersions(t);
                                    }}
                                    className={chipClass(!!versionTerm && termLabel(versionTerm) === termLabel(t))}
                                >
                                    {termLabel(t)}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => fetchVersions(versionTerm ?? targetTerm)}
                            className="flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1.5 border-2 border-black/30 text-black/50 hover:border-black hover:text-black transition-all duration-100"
                        >
                            <RefreshCw size={11} strokeWidth={2.5} />
                            Refetch
                        </button>
                    </div>

                    {versions.length === 0 ? (
                        <p className="text-xs font-bold text-black/40">회차 기록이 없습니다.</p>
                    ) : (
                        <ul className="space-y-2">
                            {versions.map((row) => (
                                <li key={row.version} className="border-2 border-black">
                                    <button
                                        onClick={() => setOpenVersion(openVersion === row.version ? null : row.version)}
                                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-retro-accent-light transition-all duration-100"
                                    >
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className="text-sm font-black shrink-0">v{row.version}</span>
                                            <span className="shrink-0 text-[10px] font-black uppercase px-1.5 py-0.5 border-2 border-black/20 text-black/50">
                                                {row.source}
                                            </span>
                                            <span className="text-xs font-bold text-black/50 truncate">{formatWhen(row.created_at)}</span>
                                        </span>
                                        <span className="shrink-0 text-xs font-bold text-black/40">{versionHeadline(row)}</span>
                                    </button>

                                    {openVersion === row.version && (
                                        <div className="border-t-2 border-black px-3 py-3 space-y-2">
                                            {row.note && <p className="text-xs font-bold text-black/50">{row.note}</p>}
                                            {row.summary ? (
                                                <ChangeSummary data={row.summary} />
                                            ) : (
                                                <p className="text-xs font-bold text-black/40">
                                                    비교할 앞 회차가 없습니다.
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-3 text-[10px] font-bold text-black/30">
                                                {row.synced !== null && <span>synced {row.synced}</span>}
                                                {row.skipped !== null && <span>skipped {row.skipped}</span>}
                                                {!!row.errors && <span>errors {row.errors}</span>}
                                                {row.elapsed && <span>{row.elapsed}</span>}
                                                {row.backup && <span className="truncate">backup: {row.backup}</span>}
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </AccordionSection>

            <AccordionSection title="Backups" icon={Archive} isOpen={openSections.backups} onToggle={() => toggle("backups")}>
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-bold text-black/40">
                            수집 직전에 자동으로 남습니다. 지워지지 않으니 총 {formatBytes(backupTotal)} — 커지면 서버에서 직접 정리하세요.
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={fetchBackups}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1.5 border-2 border-black/30 text-black/50 hover:border-black hover:text-black transition-all duration-100"
                            >
                                <RefreshCw size={11} strokeWidth={2.5} />
                                Refetch
                            </button>
                            <button
                                onClick={handleCreateBackup}
                                disabled={backupBusy}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1.5 border-2 border-black bg-black text-white hover:bg-black/80 disabled:opacity-50 transition-all duration-100"
                            >
                                <Camera size={11} strokeWidth={2.5} />
                                {backupBusy ? "Saving..." : "Snapshot"}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                        {backups.map((b) => (
                            <div
                                key={b.name}
                                className="border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] px-4 py-3 flex items-center justify-between gap-3"
                            >
                                <div className="min-w-0">
                                    <span className="font-black text-sm block">{b.created}</span>
                                    <span className="text-[10px] font-bold text-black/40 block truncate">{b.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {b.label && (
                                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 border border-black/30 text-black/50">
                                            {b.label}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-bold text-black/40">{formatBytes(b.bytes)}</span>
                                </div>
                            </div>
                        ))}
                        {backups.length === 0 && <p className="text-sm font-bold text-black/40">No backups yet.</p>}
                    </div>
                </div>
            </AccordionSection>
        </div>
    );
};

export default AdminPage;
