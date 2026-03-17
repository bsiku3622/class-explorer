import React, { useState, useEffect, useCallback } from "react";
import { Shield, Users, MonitorSmartphone, RefreshCw, Trash2, Plus, X, Check, GraduationCap } from "lucide-react";
import api from "../lib/api";
import axios from "axios";
import RetroButton from "../components/atoms/RetroButton";
import RetroSubTitle from "../components/atoms/RetroSubTitle";
import AccordionSection from "../components/molecules/AccordionSection";
import PageHeader from "../components/molecules/PageHeader";

const SESSION_TOKEN_KEY = "ksa_session_token";

function authHeader() {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
}

interface UserRow {
    id: number;
    username: string;
    is_admin: boolean;
    session_count: number;
}

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
interface SubjectRow { subject: string; aliases: string[]; }

type DataTab = "students" | "teachers" | "subjects";

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
    const [openSections, setOpenSections] = useState({ users: true, sessions: true, data: false });

    // Users
    const [users, setUsers] = useState<UserRow[]>([]);
    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newIsAdmin, setNewIsAdmin] = useState(false);
    const [createError, setCreateError] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    // Sessions
    const [sessions, setSessions] = useState<SessionRow[]>([]);

    // Sync
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

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
    const [editingSubject, setEditingSubject] = useState<string | null>(null);
    const [aliasEditVal, setAliasEditVal] = useState("");
    const [aliasSaving, setAliasSaving] = useState(false);

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

    useEffect(() => {
        fetchUsers();
        fetchSessions();
    }, [fetchUsers, fetchSessions]);

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

    const handleSaveAliases = async (subject: string) => {
        setAliasSaving(true);
        try {
            const aliases = aliasEditVal.split(",").map((a) => a.trim()).filter(Boolean);
            await api.put(`/admin/subjects/${encodeURIComponent(subject)}/aliases`, { aliases }, { headers: authHeader() });
            setSubjects((prev) => prev.map((s) => s.subject === subject ? { ...s, aliases } : s));
            setEditingSubject(null);
        } catch (e) {
            if (axios.isAxiosError(e)) setError(e.response?.data?.detail || "Failed to save aliases");
        } finally { setAliasSaving(false); }
    };

    // ── user handlers ─────────────────────────────────────────────────────────
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError("");
        setCreateLoading(true);
        try {
            await api.post("/admin/users", { username: newUsername, password: newPassword, is_admin: newIsAdmin }, { headers: authHeader() });
            setNewUsername(""); setNewPassword(""); setNewIsAdmin(false);
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

    const handleToggleAdmin = async (id: number, current: boolean) => {
        try {
            await api.patch(`/admin/users/${id}/admin`, { is_admin: !current }, { headers: authHeader() });
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

    const handleSync = async () => {
        setShowSyncConfirm(false);
        setSyncLoading(true); setSyncResult(null);
        try {
            const res = await api.post("/admin/sync", {}, { headers: authHeader() });
            setSyncResult({ ok: true, message: res.data.detail });
        } catch (e) {
            if (axios.isAxiosError(e)) setSyncResult({ ok: false, message: e.response?.data?.detail || "Sync failed" });
        } finally { setSyncLoading(false); }
    };

    const toggle = (key: keyof typeof openSections) => {
        // Data Management: 탭별 첫 오픈 시 lazy fetch
        if (key === "data" && !openSections.data) {
            if (students.length === 0) fetchStudents();
            if (teachers.length === 0) fetchTeachers();
            if (subjects.length === 0) fetchSubjects();
        }
        setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDataTabChange = (tab: DataTab) => {
        setDataTab(tab);
        setDataSearch("");
        setEditingStu(null); setEditingTeacher(null); setEditingSubject(null);
        if (tab === "students" && students.length === 0) fetchStudents();
        if (tab === "teachers" && teachers.length === 0) fetchTeachers();
        if (tab === "subjects" && subjects.length === 0) fetchSubjects();
    };

    const inputClass =
        "border-2 border-black px-3 py-2 text-sm font-bold bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] focus:shadow-none outline-none transition-all duration-100";

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

            {/* Fetch 확인 모달 */}
            {showSyncConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,0.3)] p-8 max-w-sm w-full mx-4 space-y-6">
                        <div className="space-y-2">
                            <p className="text-sm font-black uppercase tracking-widest">Fetch from KSAIN</p>
                            <p className="text-sm font-bold text-black/60 leading-relaxed">
                                이 작업은 KSAIN API에서 전체 수업 데이터를 재수집합니다.<br />
                                완료까지 <span className="text-black font-black">몇 분 이상</span> 소요될 수 있습니다.
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
                                className="text-xs font-black uppercase px-4 py-2 border-2 border-black bg-black text-white hover:bg-black/80 transition-all duration-100"
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
                                    <button
                                        onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                                        className={`text-[10px] font-black uppercase px-2 py-1 border-2 transition-all duration-100 ${
                                            u.is_admin ? "bg-black text-white border-black" : "bg-white text-black/40 border-black/30 hover:border-black hover:text-black"
                                        }`}
                                    >
                                        Admin
                                    </button>
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
                                <input type="text" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className={`${inputClass} flex-1`} required />
                                <input type="password" placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`${inputClass} flex-1`} required />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} className="w-4 h-4 border-2 border-black" />
                                    <span className="text-xs font-black uppercase tracking-widest text-black/60">Admin</span>
                                </label>
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
                                {syncLoading ? "Fetching..." : "Fetch from KSAIN"}
                            </button>
                        </div>
                    </div>

                    {syncResult && (
                        <div className={`border-2 px-3 py-2 text-xs font-bold ${syncResult.ok ? "border-green-600 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-600"}`}>
                            {syncResult.message}
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

                        {/* ── Subjects (Aliases) ── */}
                        {dataTab === "subjects" && (
                            <>
                                <p className="text-xs font-bold text-black/40">
                                    쉼표로 구분해 여러 별칭을 입력하세요. 별칭으로도 검색됩니다.
                                </p>
                                {filteredSubjects.map((s) => (
                                    <EditableRow
                                        key={s.subject}
                                        label={s.subject}
                                        isEditing={editingSubject === s.subject}
                                        editValue={aliasEditVal}
                                        onEditValueChange={setAliasEditVal}
                                        onStartEdit={() => { setEditingSubject(s.subject); setAliasEditVal(s.aliases.join(", ")); }}
                                        onSave={() => handleSaveAliases(s.subject)}
                                        onCancel={() => setEditingSubject(null)}
                                        saving={aliasSaving}
                                        placeholder="영어3, 영3, ..."
                                    >
                                        {s.aliases.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {s.aliases.map((alias) => (
                                                    <span key={alias} className="text-[10px] font-black uppercase px-1.5 py-0.5 bg-black text-white">
                                                        {alias}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </EditableRow>
                                ))}
                                {filteredSubjects.length === 0 && (
                                    <p className="text-sm font-bold text-black/40">No subjects found.</p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </AccordionSection>
        </div>
    );
};

export default AdminPage;
