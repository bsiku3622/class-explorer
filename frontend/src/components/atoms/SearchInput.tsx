import React, { useState, useRef, useEffect } from "react";
import { Search, X, Clock } from "lucide-react";
import { Input } from "@heroui/react";

const HISTORY_KEY = "ksa_search_history";
const MAX_HISTORY = 8;

function loadHistory(): string[] {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
}

function saveToHistory(term: string) {
    if (!term.trim()) return;
    const prev = loadHistory().filter((h) => h !== term);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([term, ...prev].slice(0, MAX_HISTORY)));
}

function removeFromHistory(term: string) {
    const next = loadHistory().filter((h) => h !== term);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    enableHistory?: boolean;
    /** 외부에서 searchTerm이 확정됐을 때 히스토리 저장 트리거 */
    committedTerm?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = "Search...",
    className = "",
    enableHistory = false,
    committedTerm,
}) => {
    const [focused, setFocused] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // committedTerm이 바뀔 때 히스토리 저장
    useEffect(() => {
        if (!enableHistory || !committedTerm?.trim()) return;
        saveToHistory(committedTerm);
        setHistory(loadHistory());
    }, [committedTerm, enableHistory]);

    // 포커스 시 히스토리 로드
    const handleFocus = () => {
        if (enableHistory) setHistory(loadHistory());
        setFocused(true);
    };

    // 외부 클릭 시 드롭다운 닫기
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setFocused(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleRemove = (term: string, e: React.MouseEvent) => {
        e.stopPropagation();
        removeFromHistory(term);
        setHistory(loadHistory());
    };

    const showDropdown = enableHistory && focused && history.length > 0 && !value;

    return (
        <div ref={wrapperRef} className={`relative flex flex-col ${className}`}>
            <Input
                classNames={{
                    base: "w-full",
                    innerWrapper: "flex flex-row items-center gap-2",
                    input: "text-sm md:text-xl font-semibold outline-none px-2",
                    inputWrapper:
                        "h-14 md:h-16 bg-white border-2 border-black rounded-none shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] data-[hover=true]:border-black group-data-[focus=true]:border-black",
                }}
                placeholder={placeholder}
                startContent={<Search className="text-black/40 ml-2" size={24} />}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={handleFocus}
            />
            {value && (
                <button
                    onClick={() => onChange("")}
                    className="absolute right-4 top-7 md:top-8 -translate-y-1/2 text-black/20 hover:text-black transition-colors"
                >
                    <X size={20} strokeWidth={3} />
                </button>
            )}

            {showDropdown && (
                <div className="absolute top-full left-0 right-0 z-50 border-2 border-t-0 border-black bg-white shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]">
                    <div className="px-4 py-2 border-b border-black/10 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40 flex items-center gap-1.5">
                            <Clock size={10} /> Recent
                        </span>
                        <button
                            onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}
                            className="text-[10px] font-black uppercase text-black/30 hover:text-black transition-colors"
                        >
                            Clear all
                        </button>
                    </div>
                    {history.map((term) => (
                        <div
                            key={term}
                            className="flex items-center justify-between px-4 py-2.5 hover:bg-black/5 cursor-pointer group"
                            onMouseDown={() => { onChange(term); setFocused(false); }}
                        >
                            <span className="text-sm font-bold truncate">{term}</span>
                            <button
                                onMouseDown={(e) => handleRemove(term, e)}
                                className="text-black/20 hover:text-black transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                            >
                                <X size={13} strokeWidth={2.5} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchInput;
