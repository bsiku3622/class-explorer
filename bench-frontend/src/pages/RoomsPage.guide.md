# pages/RoomsPage.tsx Guide

> [← Frontend Guide](../../CLAUDE.md)

## 역할
형설관 빈 강의실 탐색 페이지. 시간표 그리드와 층별 강의실 맵을 함께 제공합니다.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `allClassesData` | `SubjectData[]` | 전체 수업 데이터 (App.tsx에서 전달) |
| `onRoomSearch?` | `(room: string) => void` | 강의실 선택 시 Search 페이지로 이동 |

## 내부 상태
| 상태 | 설명 |
|------|------|
| `selectedSlots` | 선택된 요일-교시 셋 `"MON-2"` 형식 |
| `selectedRoom` | 선택된 강의실 이름 |
| `hoveredRoom` | 호버된 강의실 이름 |

## 레이아웃
```
[좌] 주간 시간표 그리드 (5×11)       [우] 층별 강의실 맵
  - 셀 클릭: selectedSlots 토글          - 강의실 버튼 클릭: selectedRoom 설정
  - 점유된 셀: bg-black/[0.07]            - 사용중: bg-black text-white
  - 선택된 셀: bg-black                   - 빈 교실: bg-retro-green/20

강의실 선택 시 subtitle 옆 Search 버튼 노출 → onRoomSearch(selectedRoom)
```

## 빈 교실 계산 로직
`selectedSlots`에 포함된 모든 시간대에 수업이 없는 강의실 = 빈 교실.

```ts
const occupiedRooms = selectedSlots로 필터된 수업들의 강의실 집합
const availableRooms = 형설관 강의실 목록.filter(r => !occupiedRooms.has(r))
```

## Search 연동
강의실 선택 후 "Search" 버튼 클릭 → `onRoomSearch(selectedRoom)` 호출
→ App.tsx의 `handleSearchSelect(room, false, true)` → `room:강의실명` 검색

## 강의실 데이터
- 형설관 강의실 목록은 컴포넌트 내 하드코딩 (층별 구조)
- `ClassTime.room`과 매칭하여 사용 여부 판별

## 색상 규칙 (design-guide.md 참조)
```
빈 교실:  bg-retro-green/20 border-retro-green
점유됨:   bg-black/5 border-black/20
선택됨:   bg-black text-white
호버:     ring-2 ring-black
```
