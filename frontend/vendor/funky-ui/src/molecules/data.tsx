/** 숫자 몰레큘 둘 — Stat(큰 숫자 하나) · Meter(막대 한 줄) */
import { useId, type ReactNode } from "react";

import { Link } from "../atoms/text-atoms";
import { cx } from "../internal/cx";
import { Inline, Stack } from "../primitives/layout";
import { surfaceClass } from "../primitives/Surface";
import { Text } from "../primitives/Text";
import { useAccent } from "../primitives/Paint";
import type { Accent, Tone } from "../tokens/vocabulary";
import { meterFill, meterRow, meterRowValue, meterTrack, statUnit, statValue, statValueAccent } from "./data.css";
import { Popover } from "./floating";

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  size?: "sm" | "lg";
  /** 숫자를 accent 의 진한 글자로 */
  accent?: Accent;
  /** 이름표의 글자색 (기본은 역할의 약한 잉크). 네온 면 위에서는 약한 잉크가 안 읽히므로 `inherit` 를 줍니다 */
  labelTone?: Tone;
  className?: string;
}

/** 지표 — 이름표(overline) 위, 큰 숫자 아래 */
export function Stat({ label, value, unit, size = "lg", accent, labelTone, className }: StatProps) {
  const accentCls = useAccent(accent);
  return (
    <Stack gap="xs" className={cx(accentCls, className)}>
      <Text variant={size === "lg" ? "subtitle" : "overline"} tone={labelTone}>
        {label}
      </Text>
      <Inline gap="sm" align="baseline">
        <span className={cx(statValue[size], accent && statValueAccent)}>{value}</span>
        {unit && <span className={statUnit[size]}>{unit}</span>}
      </Inline>
    </Stack>
  );
}

export interface MeterProps {
  label: ReactNode;
  value: number;
  max?: number;
  /** 막대 오른쪽에 적을 글자 (기본: 값) */
  valueLabel?: ReactNode;
  /** 막대 색 (기본: 바깥 accent, 없으면 검정) */
  accent?: Accent;
  /** 이름을 누르면 부릅니다 — 이름이 조용한 링크가 됩니다 (막대를 눌러 그 항목으로 거르기) */
  onSelect?: () => void;
  /** 막대에 마우스를 올리면 그 위에 뜨는 판의 내용 */
  tooltip?: ReactNode;
  /** `stack` 은 이름 · 값 줄 아래 막대(기본), `row` 는 넓은 화면에서 이름 · 막대 · 값을 한 줄로 둡니다 */
  layout?: "stack" | "row";
  className?: string;
}

/** 막대 한 줄 — 이름 · 막대 · 값. 홈은 well, 채움은 accent solid */
export function Meter({ label, value, max = 100, valueLabel, accent, onSelect, tooltip, layout = "stack", className }: MeterProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const labelId = useId();
  const accentCls = useAccent(accent);
  const track = (
    <div className={cx(surfaceClass({ fill: "well", border: "line" }), meterTrack)} role="meter" aria-labelledby={labelId} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(max, Math.max(0, value))}>
      <div className={meterFill} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
  const name = (
    <Text id={labelId} variant="caption" weight="black" truncate>
      {onSelect ? (
        <Link as="button" underline="hover" accent={accent} onClick={onSelect}>
          {label}
        </Link>
      ) : (
        label
      )}
    </Text>
  );
  const amount = (
    <Text variant="caption" weight="black" numeric>
      {valueLabel ?? value}
    </Text>
  );
  const bar = tooltip ? (
    <Popover content={tooltip} block delay={100} padding="md">
      {track}
    </Popover>
  ) : (
    track
  );
  if (layout === "row") {
    return (
      <div className={cx(accentCls, meterRow, className)}>
        {name}
        {bar}
        <span className={meterRowValue}>{amount}</span>
      </div>
    );
  }
  return (
    <Stack gap="xs" className={cx(accentCls, className)}>
      <Inline justify="between" gap="md">
        {name}
        {amount}
      </Inline>
      {bar}
    </Stack>
  );
}
