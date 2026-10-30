import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { SearchField } from "@studio-baeks/funky-ui";
import { clearHistory, loadHistory, removeFromHistory, saveToHistory } from "../../lib/searchHistory";

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    /** `sm`은 모달·패널 안에서 씁니다 — 페이지의 주인공이 아닌 자리에 `lg`를 두면 검색창이 화면을 다 차지합니다 */
    size?: "lg" | "sm";
    enableHistory?: boolean;
    /** 외부에서 searchTerm이 확정됐을 때 히스토리 저장 트리거 */
    committedTerm?: string;
    autoFocus?: boolean;
    /**
     * Enter 로 검색을 확정할 때 — 글자마다 서버에 물을 수 없는 검색용입니다(Admin 기억 패널).
     * ⚠️ 한글 조합 중의 Enter 는 여기서 거릅니다(`isComposing`). 안 거르면 한 번 누른 Enter 가
     * 두 번 들어옵니다.
     */
    onEnter?: () => void;
}

/** 검색 칸 + 최근 검색어 — 그리는 것은 funky-ui 의 `SearchField`, 여기는 히스토리 저장만 맡습니다 */
const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = "Search...",
    className,
    size = "lg",
    enableHistory = false,
    committedTerm,
    autoFocus = false,
    onEnter,
}) => {
    const [history, setHistory] = useState<string[]>([]);

    // committedTerm이 바뀔 때 히스토리 저장
    useEffect(() => {
        if (!enableHistory || !committedTerm?.trim()) return;
        saveToHistory(committedTerm);
        setHistory(loadHistory());
    }, [committedTerm, enableHistory]);

    return (
        <SearchField
            value={value}
            onValueChange={onChange}
            clearLabel="검색어 지우기"
            placeholder={placeholder}
            size={size}
            shadow={size === "lg"}
            autoFocus={autoFocus}
            enterKeyHint={onEnter ? "search" : undefined}
            onKeyDown={(e) => {
                if (onEnter && e.key === "Enter" && !e.nativeEvent.isComposing) onEnter();
            }}
            onFocus={() => {
                if (enableHistory) setHistory(loadHistory());
            }}
            // 입력이 비어 있을 때만 — 치는 동안에는 결과가 곧바로 아래에 나옵니다
            suggestions={enableHistory && !value ? history.map((term) => ({ value: term })) : []}
            suggestionsTitle={
                <span className="flex items-center gap-1.5">
                    <Clock size={10} /> Recent
                </span>
            }
            onSuggestionSelect={onChange}
            onSuggestionRemove={(term) => {
                removeFromHistory(term);
                setHistory(loadHistory());
            }}
            onSuggestionsClear={() => {
                clearHistory();
                setHistory([]);
            }}
            className={className}
        />
    );
};

export default SearchInput;
