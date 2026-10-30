/**
 * 하나를 고르는 줄 — SegmentedControl(값 고르기) · Tabs(화면 바꾸기).
 *
 * 둘 다 버튼 무리이고 규칙도 같습니다: 안 골린 것은 `variant`, 골린 것은 같은 accent 의 filled.
 * 다른 건 뜻과 기본 생김새입니다 — 값이면 radiogroup(기본 muted · sm · 그림자 없음 · 간격 sm),
 * 화면이면 tablist(기본 outline · sm · 그림자 · 간격 md, class-explorer 의 화면 전환 버튼).
 * 골린 칸은 105% 로 커져 그림자 위에 섭니다(Button 의 골라짐) — 쉴 때 그림자가 없는 값 줄도 같습니다.
 * 방향키 · Home · End 로 옮기면 바로 고르고, Tab 키로는 골린 칸 하나에만 들어옵니다 — 둘 다 `useSelectableGroup`.
 */
import { createContext, useContext, useId, type ReactNode } from "react";

import { cx } from "../internal/cx";
import type { IconComponent } from "../primitives/Icon";
import { Inline } from "../primitives/layout";
import { useSelectableGroup } from "../primitives/Selectable";
import { Button } from "../atoms/Button";
import type { Accent, ControlSize, Space, Variant } from "../tokens/vocabulary";
import { choiceAttached, choiceFill, choiceItemFill, tabPanel } from "./choice.css";

export interface ChoiceOption<V extends string> {
  value: V;
  label: ReactNode;
  icon?: IconComponent;
  disabled?: boolean;
}

interface ChoiceLook {
  accent?: Accent;
  /** 안 골린 칸의 칠 */
  variant?: Variant;
  size?: ControlSize;
  shadow?: boolean;
  /** 칸 사이 */
  gap?: Space;
  /** 줄을 꽉 채워 칸을 같은 폭으로 */
  fill?: boolean;
}

export interface SegmentedControlProps<V extends string> extends ChoiceLook {
  options: readonly ChoiceOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** 칸을 이어 붙입니다 — 사이가 없고 맞닿은 테두리가 하나로 겹칩니다 (Admin 의 데이터 범위) */
  attached?: boolean;
  "aria-label": string;
  className?: string;
}

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  accent,
  variant = "muted",
  size = "sm",
  shadow = false,
  gap = "sm",
  fill = false,
  attached = false,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<V>) {
  const { groupProps, itemProps } = useSelectableGroup({ value, onChange });
  return (
    <Inline role="radiogroup" aria-label={ariaLabel} gap={attached ? "0" : gap} wrap={!fill && !attached} className={cx(fill && choiceFill, attached && choiceAttached, className)} {...groupProps}>
      {options.map((o) => (
        <Button
          key={o.value}
          role="radio"
          {...itemProps(o.value)}
          accent={accent}
          variant={variant}
          size={size}
          shadow={shadow}
          grow={!attached}
          icon={o.icon}
          disabled={o.disabled}
          className={fill ? choiceItemFill : undefined}
        >
          {o.label}
        </Button>
      ))}
    </Inline>
  );
}

type Group = ReturnType<typeof useSelectableGroup<string>>;

interface TabsContextValue extends ChoiceLook {
  value: string;
  id: string;
  group: Group;
}
const TabsContext = createContext<TabsContextValue | null>(null);
const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs.* 는 <Tabs> 안에서만 씁니다");
  return ctx;
};

export interface TabsProps<V extends string> extends ChoiceLook {
  value: V;
  onChange: (value: V) => void;
  children?: ReactNode;
}

/**
 * 탭 — 버튼 줄(`Tabs.List` · `Tabs.Tab`)과 그 아래 화면(`Tabs.Panel`).
 * 기본 생김새는 class-explorer 의 화면 전환 버튼과 같은 `outline` + 그림자입니다.
 */
export function Tabs<V extends string>({ value, onChange, variant = "outline", size = "sm", shadow = true, children, ...look }: TabsProps<V>) {
  const id = useId();
  const group = useSelectableGroup<string>({ value, onChange: onChange as (v: string) => void });
  return <TabsContext.Provider value={{ value, id, group, variant, size, shadow, ...look }}>{children}</TabsContext.Provider>;
}

function TabsList({ children, className, "aria-label": ariaLabel }: { children?: ReactNode; className?: string; "aria-label": string }) {
  const { gap = "md", fill, group } = useTabs();
  return (
    <Inline role="tablist" aria-label={ariaLabel} gap={gap} wrap={!fill} className={cx(fill && choiceFill, className)} {...group.groupProps}>
      {children}
    </Inline>
  );
}

function Tab({ value, icon, disabled, children }: { value: string; icon?: IconComponent; disabled?: boolean; children?: ReactNode }) {
  const t = useTabs();
  const on = t.value === value;
  return (
    <Button
      role="tab"
      id={`${t.id}-tab-${value}`}
      aria-controls={on ? `${t.id}-panel-${value}` : undefined}
      {...t.group.itemProps(value)}
      accent={t.accent}
      variant={t.variant}
      size={t.size}
      shadow={t.shadow}
      icon={icon}
      disabled={disabled}
      className={t.fill ? choiceItemFill : undefined}
    >
      {children}
    </Button>
  );
}

function TabPanel({ value, children, className }: { value: string; children?: ReactNode; className?: string }) {
  const t = useTabs();
  if (t.value !== value) return null;
  return (
    <div role="tabpanel" id={`${t.id}-panel-${value}`} aria-labelledby={`${t.id}-tab-${value}`} className={cx(tabPanel, className)}>
      {children}
    </div>
  );
}

Tabs.List = TabsList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;
