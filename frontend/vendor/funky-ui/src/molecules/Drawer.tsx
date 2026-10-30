import type { CSSProperties, ReactNode } from "react";

import { cx } from "../internal/cx";
import { surfaceClass } from "../primitives/Surface";
import type { BorderSide, DrawerSide } from "../tokens/vocabulary";
import { drawer, drawerBody, drawerClosed, drawerHandle, drawerSide } from "./Drawer.css";

/** 판이 붙은 가장자리 쪽에는 선을 긋지 않습니다 — 세 변만 남습니다 */
const EDGE: Record<DrawerSide, BorderSide> = { right: "left", left: "right", bottom: "top" };

export interface DrawerProps {
  open: boolean;
  /** 붙는 가장자리 (기본 `right`) */
  side?: DrawerSide;
  /** 판 바깥에 붙어 닫혀 있어도 보이는 손잡이 — 여닫는 버튼은 쓰는 쪽이 그립니다 */
  handle?: ReactNode;
  "aria-label"?: string;
  className?: string;
  /** 판의 폭 · 높이 · 상단 바를 비키는 `top` 처럼 실행 중에 정해지는 값 */
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * 가장자리에서 밀려 나오는 판 — 뒤 화면을 막지 않습니다(옆에 두고 함께 보는 패널). 막아야 하면 `Modal` 입니다.
 * 닫혀 있는 동안 안쪽은 `inert` 라 Tab 이 들어가지 않습니다.
 */
export function Drawer({ open, side = "right", handle, "aria-label": ariaLabel, className, style, children }: DrawerProps) {
  return (
    <aside
      aria-label={ariaLabel}
      className={cx(surfaceClass({ border: "line", borderSide: EDGE[side] }), drawer, drawerSide[side], !open && drawerClosed[side], className)}
      style={style}
    >
      {handle && <div className={drawerHandle[side]}>{handle}</div>}
      <div className={drawerBody} inert={!open}>
        {children}
      </div>
    </aside>
  );
}
