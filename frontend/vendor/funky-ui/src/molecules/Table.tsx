import { createContext, useContext, type ComponentPropsWithRef, type ReactNode } from "react";

import { cx } from "../internal/cx";
import { surfaceClass } from "../primitives/Surface";
import type { TableHead as TableHeadTone } from "../tokens/vocabulary";
import { table, tableCell, tableCellPlain, tableDivided, tableDividedPlain, tableHeadCell, tableNumeric, tableRowHeader, tableRowHover, tableWrap } from "./Table.css";

const HeadTone = createContext<TableHeadTone>("inverse");

export interface TableProps extends ComponentPropsWithRef<"table"> {
  /** 머리 줄의 칠 (기본 `inverse` — 검정) */
  head?: TableHeadTone;
  /** 바깥 틀에 붙는 class */
  frameClassName?: string;
  children?: ReactNode;
}

/**
 * 데이터 표 — 2px 검정 틀 안의 native `<table>`. 폭이 모자라면 표만 가로로 스크롤합니다.
 * 요일 × 교시 시간표는 `TimetableGrid`, 읽는 값의 표는 이것입니다.
 *
 * ```tsx
 * <Table aria-label="학기별 학점">
 *   <Table.Head><Table.Row><Table.HeadCell>학기</Table.HeadCell><Table.HeadCell numeric>학점</Table.HeadCell></Table.Row></Table.Head>
 *   <Table.Body><Table.Row><Table.Cell header>1학기</Table.Cell><Table.Cell numeric>18</Table.Cell></Table.Row></Table.Body>
 * </Table>
 * ```
 */
export function Table({ head = "inverse", frameClassName, className, children, ...rest }: TableProps) {
  return (
    <HeadTone.Provider value={head}>
      <div className={cx(surfaceClass({ border: "line" }), tableWrap, frameClassName)}>
        <table className={cx(table, className)} {...rest}>
          {children}
        </table>
      </div>
    </HeadTone.Provider>
  );
}

function TableHeadPart(props: ComponentPropsWithRef<"thead">) {
  return <thead {...props} />;
}

function TableBody(props: ComponentPropsWithRef<"tbody">) {
  return <tbody {...props} />;
}

export interface TableRowProps extends ComponentPropsWithRef<"tr"> {
  /** 마우스를 올리면 줄이 한 단 어두워집니다 — 줄 전체를 누르거나 훑어 읽는 표 */
  hoverable?: boolean;
}

function TableRow({ hoverable, className, ...rest }: TableRowProps) {
  return <tr className={cx(hoverable && tableRowHover, className)} {...rest} />;
}

export interface TableHeadCellProps extends ComponentPropsWithRef<"th"> {
  /** 숫자 열 — 오른쪽 정렬 */
  numeric?: boolean;
  /** 열 묶음의 왼쪽 선 */
  divided?: boolean;
}

function TableHeadCell({ numeric, divided, className, ...rest }: TableHeadCellProps) {
  const tone = useContext(HeadTone);
  return <th scope="col" className={cx(tableHeadCell[tone], numeric && tableNumeric, divided && (tone === "plain" ? tableDividedPlain : tableDivided), className)} {...rest} />;
}

export interface TableCellProps extends ComponentPropsWithRef<"td"> {
  /** 행 머리 — `<th scope="row">` 로 그립니다 */
  header?: boolean;
  /** 숫자 칸 — 오른쪽 정렬 · 같은 폭의 숫자 */
  numeric?: boolean;
  /** 열 묶음의 왼쪽 선 */
  divided?: boolean;
}

function TableCell({ header, numeric, divided, className, ...rest }: TableCellProps) {
  const plain = useContext(HeadTone) === "plain";
  const cls = cx(tableCell, header && tableRowHeader, numeric && tableNumeric, divided && tableDivided, plain && tableCellPlain, plain && divided && tableDividedPlain, className);
  return header ? <th scope="row" className={cls} {...rest} /> : <td className={cls} {...rest} />;
}

Table.Head = TableHeadPart;
Table.Body = TableBody;
Table.Row = TableRow;
Table.HeadCell = TableHeadCell;
Table.Cell = TableCell;
