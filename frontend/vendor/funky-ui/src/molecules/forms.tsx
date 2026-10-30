/** 입력 몰레큘 둘 — SearchField(검색 칸) · FormField(이름표 + 칸 + 안내) */
import { Children, cloneElement, isValidElement, useId, useRef, useState, type ChangeEvent, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode } from "react";

import { cx } from "../internal/cx";
import { CloseGlyph, SearchGlyph } from "../internal/glyphs";
import { Input, type InputProps } from "../atoms/fields";
import { Label, Link } from "../atoms/text-atoms";
import { Floating } from "../primitives/Floating";
import { Stack } from "../primitives/layout";
import { usePressable } from "../primitives/Pressable";
import { surfaceClass } from "../primitives/Surface";
import { Text } from "../primitives/Text";
import { CONTROL } from "../tokens/shape";
import { fieldError, fieldWarning, searchClear, searchIcon, searchInput, searchWrap, suggest, suggestHead, suggestItem, suggestRemove, suggestRow } from "./forms.css";

export interface SearchSuggestion {
  value: string;
  /** 보이는 글자 (기본: `value`) */
  label?: ReactNode;
}

export interface SearchFieldProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  /** 지우기 버튼을 눌렀을 때 (기본: 빈 문자열로) */
  onClear?: () => void;
  clearLabel?: string;
  /** 칸에 포커스가 있는 동안 아래에 붙는 제안 — 최근 검색어. 언제 비울지는 부르는 쪽이 정합니다 (예: 입력이 비었을 때만) */
  suggestions?: readonly SearchSuggestion[];
  /** 목록 머리의 글자 */
  suggestionsTitle?: ReactNode;
  onSuggestionSelect?: (value: string) => void;
  /** 주면 줄마다 지우기 버튼이 붙습니다 */
  onSuggestionRemove?: (value: string) => void;
  /** 주면 머리에 전체 지우기가 붙습니다 */
  onSuggestionsClear?: () => void;
}

/** 제안 한 줄 — 움직이지 않는 Pressable 에 hover 층(Surface) */
function SuggestionRow({ item, onSelect, onRemove }: { item: SearchSuggestion; onSelect?: (value: string) => void; onRemove?: (value: string) => void }) {
  const { Comp, pressProps } = usePressable({});
  return (
    <div className={suggestRow}>
      <Comp {...pressProps} className={cx(pressProps.className, surfaceClass({ fill: "none", hoverable: true }), suggestItem)} onClick={() => onSelect?.(item.value)}>
        {item.label ?? item.value}
      </Comp>
      {onRemove && (
        <button type="button" aria-label={`${item.value} 지우기`} className={suggestRemove} onClick={() => onRemove(item.value)}>
          <CloseGlyph size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * 검색 칸 — 앞에 돋보기, 값이 있으면 뒤에 지우기, 포커스가 있는 동안 아래에 제안. 한글 조합 중 Enter 는 부르는 쪽이 거릅니다.
 * ⚠️ 제안은 Menu 가 아닙니다 — Menu 는 열 때 포커스를 판 안으로 옮겨서 입력 중에 쓸 수 없습니다. 판을 눌러도 포커스는 입력에 남습니다.
 */
export function SearchField({
  value,
  onValueChange,
  onClear,
  clearLabel = "지우기",
  size = "md",
  suggestions = [],
  suggestionsTitle,
  onSuggestionSelect,
  onSuggestionRemove,
  onSuggestionsClear,
  className,
  ...rest
}: SearchFieldProps) {
  const icon = CONTROL.icon[size];
  const anchor = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);
  const onBlur = (e: FocusEvent<HTMLSpanElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };
  return (
    <span ref={anchor} className={cx(searchWrap, className)} onFocus={() => setFocused(true)} onBlur={onBlur}>
      <SearchGlyph size={icon} strokeWidth={3} className={searchIcon[size]} />
      <Input
        type="search"
        size={size}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value)}
        className={searchInput[size]}
        {...rest}
      />
      {value && (
        <button type="button" aria-label={clearLabel} className={searchClear[size]} onClick={() => (onClear ? onClear() : onValueChange(""))}>
          <CloseGlyph size={icon} />
        </button>
      )}
      {focused && suggestions.length > 0 && (
        <Floating
          anchor={anchor}
          onDismiss={() => setFocused(false)}
          className={cx(surfaceClass({ border: "line", shadow: "raised" }), suggest)}
          onPointerDown={(e: PointerEvent) => e.preventDefault()}
        >
          {(suggestionsTitle || onSuggestionsClear) && (
            <div className={suggestHead}>
              <Text variant="overline">{suggestionsTitle}</Text>
              {onSuggestionsClear && (
                <Text variant="micro" tone="muted">
                  <Link as="button" underline="hover" onClick={onSuggestionsClear}>
                    Clear all
                  </Link>
                </Text>
              )}
            </div>
          )}
          {suggestions.map((s) => (
            <SuggestionRow key={s.value} item={s} onSelect={onSuggestionSelect} onRemove={onSuggestionRemove} />
          ))}
        </Floating>
      )}
    </span>
  );
}

export interface FormFieldProps {
  label: ReactNode;
  /** 칸 아래 안내 */
  hint?: ReactNode;
  /** 틀렸을 때의 안내 — 주면 칸이 빨갛게 바뀝니다 */
  error?: ReactNode;
  /** 막지 않는 경고 — 주면 칸이 주황으로 바뀝니다. `error` 가 있으면 그쪽이 앞섭니다 */
  warning?: ReactNode;
  required?: boolean;
  /** 칸 하나 (Input · Textarea · Select). id 와 aria 속성은 FormField 가 붙입니다 */
  children: ReactElement<Record<string, unknown>>;
  className?: string;
}

/** 이름표 + 칸 + 안내를 한 묶음으로 — 이름표와 안내가 칸에 연결됩니다 */
export function FormField({ label, hint, error, warning, required, children, className }: FormFieldProps) {
  const autoId = useId();
  const child = Children.only(children);
  const own = isValidElement(child) ? child.props : {};
  // 칸이 이미 가진 값은 덮지 않고 잇습니다 — id 는 칸의 것을 쓰고, 설명은 칸의 것 뒤에 붙입니다
  const id = typeof own.id === "string" ? own.id : autoId;
  const noteId = `${id}-note`;
  const note = error ?? warning ?? hint;
  const describedBy = [own["aria-describedby"], note ? noteId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <Stack gap="xs" className={className}>
      <Label htmlFor={id} required={required ?? Boolean(own.required)}>
        {label}
      </Label>
      {isValidElement(child)
        ? cloneElement(child, {
            id,
            "aria-describedby": describedBy,
            invalid: error ? true : own.invalid,
            warning: !error && warning ? true : own.warning,
            required: required ?? own.required,
          })
        : child}
      {note && (
        <Text id={noteId} variant="caption" tone={error || warning ? undefined : "muted"} className={error ? fieldError : warning ? fieldWarning : undefined}>
          {note}
        </Text>
      )}
    </Stack>
  );
}
