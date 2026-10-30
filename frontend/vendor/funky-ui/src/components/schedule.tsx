/**
 * 시간표 — ClassTile(수업 한 칸) · TimetableGrid(한 주 격자) · BreakBand(수업이 없는 시간) · TimeCaret(지금) · SlotCell(상태 면 칸).
 *
 * 수업 칸은 학과색 문법(면 12% · 테두리 · 글자)을 따릅니다. "지금" 은 학과색 대신 핑크 사다리의
 * Plain 문법(soft 면 · solid 테두리 · solidInk 글자)이라, 글자는 AA 를 지키고 면은 옅게 남습니다.
 * ⚠️ "지금" 을 핑크로 꽉 채우지 않습니다 — 그 칸 하나가 화면에서 제일 센 물건이 되어 옆을 읽는 걸
 * 방해합니다.
 */
import type { CSSProperties, ReactNode } from "react";

import { cx } from "../internal/cx";
import { usePressable } from "../primitives/Pressable";
import { surfaceClass } from "../primitives/Surface";
import { NEONS } from "../tokens/palette";
import {
  breakBand,
  grid,
  gridBand,
  gridCell,
  gridCellFlush,
  gridCorner,
  gridDay,
  gridDayToday,
  gridPeriod,
  slotCell,
  slotState,
  tile,
  tileMeta,
  tileMetaWrap,
  tilePress,
  tileState,
  tileTitle,
  tileTitleClamp,
  timeCaret,
  timeCaretLabel,
  timeCaretMark,
} from "./schedule.css";
import { toneStyle } from "./tone";

export type ClassTileState = "upcoming" | "now" | "past" | "free" | "focus" | "dim";

export interface ClassTileProps {
  /** 과목명 */
  title?: ReactNode;
  /** 아래 줄 — 교실 · 교사 · 시각 */
  meta?: ReactNode;
  /** 학과색 (hex). `now` 는 이 색을 무시하고 핑크를 씁니다 */
  color?: string;
  /**
   * - `upcoming` 학과색 · `now` 핑크(지금) · `past` 같은 색을 40% 로 · `free` 공강(점선, 면 없음)
   * - `focus` 밖에서 지목한 칸(면을 진하게) · `dim` 지목한 칸 말고 나머지(20%)
   */
  state?: ClassTileState;
  /** 과목명을 두 줄까지 보입니다 (기본 1 — 넘치면 자릅니다) */
  titleLines?: 1 | 2;
  /** 아래 줄 정보를 줄바꿈합니다 (기본은 한 줄에서 자릅니다) */
  metaWrap?: boolean;
  /** 주면 누르는 칸이 됩니다 */
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function ClassTile({ title, meta, color, state = "upcoming", titleLines = 1, metaWrap = false, onClick, className, style, children }: ClassTileProps) {
  const tone = state === "now" ? NEONS.pink : color;
  const { Comp, pressProps } = usePressable({ as: onClick ? "button" : "div" });
  const pressable = onClick ? pressProps : {};
  return (
    <Comp {...pressable} onClick={onClick} className={cx(onClick && pressProps.className, tile, tileState[state], onClick && tilePress, className)} style={toneStyle(tone, style)}>
      {title && <span className={cx(tileTitle, titleLines === 2 && tileTitleClamp)}>{title}</span>}
      {meta && <span className={cx(tileMeta, metaWrap && tileMetaWrap)}>{meta}</span>}
      {children}
    </Comp>
  );
}

export interface BreakBandProps {
  /** 띠의 이름 — 점심 · 저녁 */
  label?: ReactNode;
  className?: string;
  /** 높이처럼 실행 중에 정해지는 값 — 분에 비례하는 띠 */
  style?: CSSProperties;
}

/** 수업이 없는 시간 — 빗금 면에 이름 라벨. 시간표의 점심 · 저녁, 시간선의 쉬는 구간에 씁니다 */
export function BreakBand({ label, className, style }: BreakBandProps) {
  return (
    <div className={cx(breakBand, className)} style={style}>
      {label}
    </div>
  );
}

export interface TimeCaretProps {
  /** 축 위의 자리 (0~100, %) */
  position: number;
  /** 주면 마름모 대신 이 꼬리표를 답니다 — `D-3` */
  label?: ReactNode;
  className?: string;
}

/** 지금을 짚는 선 + 마름모 — 시간 · 날짜 축 위에 얹습니다. 부모가 `position: relative` 입니다. 시간이 흐르면 천천히 옮겨 갑니다 */
export function TimeCaret({ position, label, className }: TimeCaretProps) {
  return (
    <span aria-hidden="true" className={cx(timeCaret, className)} style={{ left: `${Math.min(100, Math.max(0, position))}%` }}>
      {label ? <span className={timeCaretLabel}>{label}</span> : <span className={timeCaretMark} />}
    </span>
  );
}

export type SlotState = "free" | "busy" | "selected" | "conflict" | "common" | "empty";

export interface SlotCellProps {
  /** 칸의 상태 — `free` 비어 있음(초록) · `busy` 점유(회색) · `selected` 고름(검정) · `conflict` 충돌(주황) · `common` 공통(핑크) · `empty` 면 없음 */
  state: SlotState;
  /** 주면 누르는 칸이 됩니다 */
  onToggle?: () => void;
  /** 스크린 리더가 읽을 칸의 이름 — 글자가 없는 칸에 줍니다 */
  label?: string;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

/** 칸 전체를 상태 면으로 칠하는 격자 칸 — `TimetableGrid flush` 안에 둡니다. 시간을 고르는 격자(빈 강의실 · 분석 비교)에 씁니다 */
export function SlotCell({ state, onToggle, label, disabled, className, children }: SlotCellProps) {
  const { Comp, pressProps } = usePressable({ as: onToggle ? "button" : "div", disabled });
  const pressable = onToggle ? pressProps : {};
  return (
    <Comp {...pressable} onClick={onToggle} aria-label={label} aria-pressed={onToggle ? state === "selected" : undefined} className={cx(onToggle && pressProps.className, slotCell, slotState[state], className)}>
      {children}
    </Comp>
  );
}

export interface TimetableDay {
  key: string;
  label: ReactNode;
  /** 오늘 — 검은 머리 줄에서 이 칸만 흰 칸으로 뒤집힙니다 */
  today?: boolean;
}

export interface TimetablePeriod {
  key: string;
  label: ReactNode;
  /** 주면 칸 대신 요일 열 전체를 잇는 띠 행입니다 — 점심 · 저녁 (`BreakBand`) */
  band?: ReactNode;
}

export interface TimetableGridProps {
  days: readonly TimetableDay[];
  periods: readonly TimetablePeriod[];
  renderCell: (day: string, period: string) => ReactNode;
  /** 왼쪽 위 칸 (기본 "Pd") */
  corner?: ReactNode;
  /** 칸을 가장자리까지 채웁니다 — 상태 면으로 칠하는 격자(`SlotCell`) */
  flush?: boolean;
  className?: string;
}

/** 한 주 격자 — 머리 줄은 검정, 교시 열은 well, 칸 사이는 카드 안 구분선입니다 */
export function TimetableGrid({ days, periods, renderCell, corner = "Pd", flush = false, className }: TimetableGridProps) {
  return (
    <div role="table" className={cx(surfaceClass({ border: "line" }), grid, className)} style={{ gridTemplateColumns: `2.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
      <div role="row" style={{ display: "contents" }}>
        <div role="columnheader" className={gridCorner}>
          {corner}
        </div>
        {days.map((d) => (
          <div key={d.key} role="columnheader" className={cx(gridDay, d.today && gridDayToday)}>
            {d.label}
          </div>
        ))}
      </div>
      {periods.map((p) => (
        <div key={p.key} role="row" style={{ display: "contents" }}>
          <div role="rowheader" className={gridPeriod}>
            {p.label}
          </div>
          {p.band !== undefined ? (
            <div role="cell" className={gridBand}>
              <BreakBand label={p.band} />
            </div>
          ) : (
            days.map((d) => (
              <div key={d.key} role="cell" className={cx(gridCell, flush && gridCellFlush)}>
                {renderCell(d.key, p.key)}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
