/**
 * 앱 셸 — AppBar(상단 바) · SideNav(데스크톱 왼쪽 메뉴) · BottomNav(모바일 하단 바) · TermSwitcher.
 *
 * 자리(fixed · 높이)는 class-explorer 의 셸 치수(`CONTAINER.shell`)를 따르고, 화면에 고정할지는
 * `fixed` 로 고릅니다. 메뉴 순서는 앱(`lib/navigation.ts`)이 정합니다 — 셸은 그리기만 합니다.
 * 바 둘은 구조 면이라 Surface 의 `brand`(보라)로 칠합니다 — 버튼처럼 색을 고르는 요소가 아닙니다.
 */
import { useEffect, useRef, type ComponentPropsWithRef, type ElementType, type ReactNode } from "react";

import { SPACE } from "../tokens/layout";
import { cx } from "../internal/cx";
import { ChevronDownGlyph } from "../internal/glyphs";
import { NavButton } from "../atoms/NavButton";
import { pressOf } from "../atoms/Button";
import { Wordmark } from "../atoms/text-atoms";
import { Menu } from "../molecules/floating";
import { Icon, type IconComponent } from "../primitives/Icon";
import { paintClass } from "../primitives/Paint";
import { usePressable } from "../primitives/Pressable";
import { useSelectable } from "../primitives/Selectable";
import { Surface } from "../primitives/Surface";
import {
  appBar,
  appBarActions,
  appBarFixed,
  bottomItem,
  bottomItemActive,
  bottomItemLabel,
  bottomNav,
  bottomNavFixed,
  sideItem,
  sideNav,
  sideNavBody,
  sideNavFixed,
  sideNavFooter,
  sideSection,
  sideSectionLabel,
} from "./shell.css";

const SurfaceRoot = Surface as ElementType;

export interface AppBarProps {
  /** 로고 글자 — 기울어진 900 대문자로 그립니다 */
  brand: ReactNode;
  onBrandClick?: () => void;
  /** 오른쪽 끝 — 학기 선택 · 계정 · 로그아웃 */
  actions?: ReactNode;
  /** 화면 위에 고정 (기본 false) */
  fixed?: boolean;
  className?: string;
}

/** 상단 바 — `Surface` 의 brand(보라 면 · 흰 글자) · 아래 2px 검정 · 아래로 4px 그림자 */
export function AppBar({ brand: label, onBrandClick, actions, fixed = false, className }: AppBarProps) {
  return (
    <SurfaceRoot as="header" fill="brand" className={cx(appBar, fixed && appBarFixed, className)}>
      <Wordmark onClick={onBrandClick}>{label}</Wordmark>
      {actions && <div className={appBarActions}>{actions}</div>}
    </SurfaceRoot>
  );
}

export interface SideNavProps {
  /** 맨 아래에 붙는 자리 (System Status) — 메뉴만 스크롤되고 이건 늘 보입니다 */
  footer?: ReactNode;
  /** 상단 바 아래 왼쪽에 고정 (기본 false) */
  fixed?: boolean;
  className?: string;
  children?: ReactNode;
}

export function SideNav({ footer, fixed = false, className, children }: SideNavProps) {
  return (
    <SurfaceRoot as="aside" fill="canvas" className={cx(sideNav, fixed && sideNavFixed, className)}>
      <nav className={sideNavBody}>{children}</nav>
      {footer && <div className={sideNavFooter}>{footer}</div>}
    </SurfaceRoot>
  );
}

function SideNavSection({ label, children }: { label?: ReactNode; children?: ReactNode }) {
  return (
    <div className={sideSection}>
      {label && <p className={sideSectionLabel}>{label}</p>}
      {children}
    </div>
  );
}

export interface SideNavItemProps {
  icon: IconComponent;
  /** 지금 화면 — `aria-current="page"` 로 알립니다 */
  active?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

/**
 * Pressable + Selectable + Paint — 지금 화면은 검정 filled 가 4px 위에 떠 있고(hover 때 가라앉음), 나머지는
 * ghostMuted 로 물러납니다. 골라진 버튼처럼 커지지 않고 variant 를 바꿉니다 — class-explorer 사이드바가 그렇습니다.
 * 내비는 Tab 키로 칸마다 들르는 것이 맞아 방향키 무리(useSelectableGroup)로 묶지 않습니다.
 */
function SideNavItem({ icon, active = false, onClick, children }: SideNavItemProps) {
  const ref = useRef<HTMLElement>(null);
  // 창이 낮으면 지금 화면의 줄이 메뉴 스크롤에 잘릴 수 있어, 그때만 메뉴 안에서 옮겨 보여 줍니다.
  // ⚠️ `scrollIntoView` 를 쓰지 않습니다 — 페이지까지 같이 끌고 갑니다
  useEffect(() => {
    const item = ref.current;
    const box = item?.closest("nav");
    if (!active || !item || !box) return;
    const reveal = () => {
      if (!box.clientHeight) return;
      const itemRect = item.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      if (itemRect.bottom + SPACE.md > boxRect.bottom) box.scrollTop += itemRect.bottom + SPACE.md - boxRect.bottom;
      else if (itemRect.top - SPACE.md < boxRect.top) box.scrollTop -= boxRect.top - itemRect.top + SPACE.md;
    };
    const observer = new ResizeObserver(reveal);
    observer.observe(box);
    return () => observer.disconnect();
  }, [active]);
  const variant = active ? "filled" : "ghostMuted";
  const { Comp, pressProps } = usePressable({ motion: pressOf(variant, active, undefined).motion });
  const { selectProps } = useSelectable({ selected: active, current: "page" });
  return (
    <Comp
      ref={ref}
      {...pressProps}
      {...selectProps}
      onClick={onClick}
      className={cx(pressProps.className, paintClass({ accent: "black", variant, hoverable: true }), sideItem)}
    >
      <Icon icon={icon} size="lg" />
      <span>{children}</span>
    </Comp>
  );
}

SideNav.Section = SideNavSection;
SideNav.Item = SideNavItem;

export interface BottomNavProps {
  /** 화면 아래에 고정 (기본 false) — 넓은 화면(md 이상)에서는 숨습니다 */
  fixed?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * 모바일 하단 바 — `Surface` 의 brand · 위 2px 검정 · 위로 4px 그림자. 다섯 칸까지 — 여덟 칸을 욱여넣으면 칸이
 * 좁아져 이름이 잘리고 손가락이 옆 칸을 누릅니다
 */
export function BottomNav({ fixed = false, className, children }: BottomNavProps) {
  return (
    <SurfaceRoot as="nav" fill="brand" className={cx(bottomNav, fixed && bottomNavFixed, className)}>
      {children}
    </SurfaceRoot>
  );
}

/** 나머지 props 는 `<button>` 으로 갑니다 — More 칸이 판을 붙일 `ref` 와 `aria-expanded` 를 달 수 있습니다 */
function BottomNavItem({ icon, active = false, onClick, children, ...rest }: SideNavItemProps & Omit<ComponentPropsWithRef<"button">, keyof SideNavItemProps>) {
  const { Comp, pressProps } = usePressable({ motion: "tap" });
  const { selectProps } = useSelectable({ selected: active, current: "page" });
  return (
    <Comp {...pressProps} {...selectProps} onClick={onClick} className={cx(pressProps.className, bottomItem, active && bottomItemActive)} {...rest}>
      <Icon icon={icon} size="lg" />
      <span className={bottomItemLabel}>{children}</span>
    </Comp>
  );
}

BottomNav.Item = BottomNavItem;

export interface TermOption {
  value: string;
  label: string;
}

export interface TermSwitcherProps {
  terms: readonly TermOption[];
  value: string;
  onChange: (value: string) => void;
}

/** 학기 선택 — 상단 바 위 유리 버튼이 목록을 엽니다. 학기가 쌓여도 바를 잡아먹지 않습니다 */
export function TermSwitcher({ terms, value, onChange }: TermSwitcherProps) {
  if (terms.length < 2) return null;
  const current = terms.find((t) => t.value === value);
  return (
    <Menu
      aria-label="학기"
      align="end"
      value={value}
      items={terms}
      onSelect={onChange}
      trigger={<NavButton iconEnd={ChevronDownGlyph}>{current?.label ?? "TERM"}</NavButton>}
    />
  );
}
