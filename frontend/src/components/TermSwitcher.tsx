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
        <div className="flex items-center gap-2">
            {terms.map((term) => {
                const selected = isSame(current, term);
                return (
                    <button
                        key={`${term.year}-${term.semester}`}
                        onClick={() => onChange(term)}
                        className={`border-2 px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-all duration-100 ${
                            selected
                                ? "border-white/30 hover:border-white bg-white/10 hover:bg-white/20 text-white"
                                : "border-transparent text-white/40 hover:text-white/70"
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
