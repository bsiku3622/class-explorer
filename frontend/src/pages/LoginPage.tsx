import React, { useState } from "react";
import axios from "axios";
import api from "../lib/api";
import RetroCard from "../components/atoms/RetroCard";
import RetroButton from "../components/atoms/RetroButton";

interface LoginPageProps {
    onLogin: (token: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (e.nativeEvent instanceof KeyboardEvent && (e.nativeEvent as KeyboardEvent & { isComposing: boolean }).isComposing) return;
        setError("");
        setLoading(true);
        try {
            const res = await api.post("/auth/login", { username, password });
            onLogin(res.data.session_token);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                setError("아이디 또는 비밀번호가 틀렸습니다.");
            } else {
                setError("로그인 중 오류가 발생했습니다.");
            }
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        "w-full border-2 border-black px-4 py-3 text-sm font-bold bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] focus:shadow-none outline-none transition-all duration-100";

    return (
        <div className="min-h-screen bg-retro-bg flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-black tracking-tighter text-black uppercase transform -skew-x-6 inline-block">
                        Class Explorer
                    </h1>
                    <p className="text-[11px] font-black text-black/40 uppercase tracking-[0.2em] mt-2">
                        KSA Timetable System
                    </p>
                </div>

                <RetroCard shadow="lg" className="bg-white p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className={inputClass}
                                autoComplete="username"
                                autoFocus
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={inputClass}
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        {error && (
                            <p className="text-xs font-bold text-red-600 border-2 border-red-500 px-3 py-2 bg-red-50">
                                {error}
                            </p>
                        )}

                        <RetroButton
                            type="submit"
                            variant="black"
                            size="md"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? "로그인 중..." : "로그인"}
                        </RetroButton>
                    </form>
                </RetroCard>
            </div>
        </div>
    );
};

export default LoginPage;
