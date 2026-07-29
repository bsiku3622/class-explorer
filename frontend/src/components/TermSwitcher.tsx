import React from "react";
import type { Term } from "../types";

interface TermSwitcherProps {
    terms: Term[];
    current: Term | null;
    onChange: (term: Term) => void;
}

const isSame = (a: Term | null, b: Term) =>
    a?.year === b.year && a?.semester === b.semester;

/** 네비게이션 바 전용 학기 전환 토글 (다크 배경 기준 스타일) */
const TermSwitcher: React.FC<TermSwitcherProps> = ({ terms, current, onChange }) => {
    if (terms.length < 2) return null;

    return (
        <div className="flex items-center border-2 border-white/30">
            {terms.map((term) => {
                const selected = isSame(current, term);
                return (
                    <button
                        key={`${term.year}-${term.semester}`}
                        onClick={() => onChange(term)}
                        className={`px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all duration-100 ${
                            selected
                                ? "bg-white text-black"
                                : "text-white/50 hover:text-white hover:bg-white/10"
                        }`}
                    >
                        <span className="hidden sm:inline">{term.year}</span>
                        <span className="sm:hidden">{String(term.year).slice(2)}</span>
                        -{term.semester}
                    </button>
                );
            })}
        </div>
    );
};

export default TermSwitcher;
