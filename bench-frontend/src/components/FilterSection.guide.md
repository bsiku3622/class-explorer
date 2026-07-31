# FilterSection Guide

> [← Component Guide](../../../../frontend/component-guide.md)

## 역할
학년 필터 선택 UI. 학번 연도별 체크박스 + 새로고침.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `studentCounts` | `Record<string, number>` | 학년별 학생 수 |
| `selectedYears` | `string[]` | 현재 선택된 학년 목록 |
| `setSelectedYears` | `(years: string[]) => void` | 학년 선택 변경 핸들러 |
| `lastUpdated` | `number \| null` | 마지막 업데이트 타임스탬프 |
| `fetchInitialData` | `(force?: boolean) => void` | 데이터 새로고침 함수 |
| `loading` | `boolean` | 로딩 상태 |

## 레이아웃
```
[전체 토글] [23 (85명)] [24 (90명)] [25 (92명)] [26 (88명)]  [🔄 Refresh]
```

## 동작
- 학년 클릭: `selectedYears` 토글 (이미 있으면 제거, 없으면 추가)
- 전체 선택: 모든 학년 선택 / 전체 해제
- Refresh: `fetchInitialData(true)` 호출 (캐시 무시)
- 색상: 각 학년 버튼에 `getStudentColor(year+"-")` 적용

## 각 학년 버튼 스타일
```
isSelected=true:  RetroButton variant="black" (기본)
isSelected=false: RetroButton variant="white"
학번 색상으로 테두리/배경 오버라이드
```
