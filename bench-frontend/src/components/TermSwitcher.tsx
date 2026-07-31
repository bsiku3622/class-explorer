import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Term } from "../types";

interface TermSwitcherProps {
    terms: Term[];
    current: Term | null;
    onChange: (term: Term) => void;
}

const isSame = (a: Term | null, b: Term) =>
    a?.year === b.year && a?.semester === b.semester;

const label = (term: Term) => `${term.year}-${term.semester}`;

/**
 * 네비게이션 바 전용 학기 선택 드롭다운 (다크 배경 기준 스타일).
 *
 * 학기를 나란히 늘어놓으면 학기가 쌓일수록 네비게이션을 다 잡아먹어서 접었습니다.
 */
const TermSwitcher: React.FC<TermSwitcherProps> = ({ terms, current, onChange }) => {
    const [open, setOpen] = useState(false);
    const wrapper = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleDown = (e: MouseEvent) => {
            if (wrapper.current && !wrapper.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", handleDown);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleDown);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    if (terms.length < 2) return null;

    return (
        <div ref={wrapper} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex shrink-0 items-center gap-2 border-2 border-white/30 hover:border-white bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 transition-all duration-100"
            >
                <span className="whitespace-nowrap text-xs font-black uppercase tracking-widest">
                    {current ? label(current) : "TERM"}
                </span>
                <ChevronDown
                    size={14}
                    strokeWidth={3}
                    className={`transition-transform duration-100 ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div
                    role="listbox"
                    className="absolute right-0 top-full z-50 mt-2 min-w-full whitespace-nowrap border-2 border-black bg-white shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
                >
                    {terms.map((term) => {
                        const selected = isSame(current, term);
                        return (
                            <button
                                key={label(term)}
                                role="option"
                                aria-selected={selected}
                                onClick={() => {
                                    onChange(term);
                                    setOpen(false);
                                }}
                                className={`block w-full px-4 py-2.5 text-left text-xs font-black uppercase tracking-widest transition-colors duration-100 ${
                                    selected
                                        ? "bg-black text-white"
                                        : "text-black hover:bg-black/5"
                                }`}
                            >
                                {label(term)}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TermSwitcher;
