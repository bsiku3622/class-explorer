import { cx } from "../internal/cx";
import { spinner, spinnerSize } from "./Spinner.css";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  /** 스크린 리더가 읽을 이름 */
  label?: string;
  className?: string;
}

/** 도는 고리 — 옅은 링 위에 한 조각만 진해서 회전이 읽힙니다. 색은 글자색을 따릅니다 */
export function Spinner({ size = "md", label = "불러오는 중", className }: SpinnerProps) {
  return <span role="status" aria-label={label} className={cx(spinner, spinnerSize[size], className)} />;
}
