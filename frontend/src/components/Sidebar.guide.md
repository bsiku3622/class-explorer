# Sidebar Guide

> [← Component Guide](../../../../frontend/component-guide.md)

## 역할
좌측 고정 사이드바. 페이지 이동 메뉴 + 시스템 상태 표시.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `activePage` | `string` | 현재 활성 페이지 ID |
| `setActivePage` | `(id: string) => void` | 페이지 이동 핸들러 |

## 메뉴 항목
| ID | 아이콘 | 경로 | 레이블 |
|----|--------|------|--------|
| `home` | `Home` | `/` | Home |
| `empty-room` | `DoorOpen` | `/emptyroomfinder` | Rooms |
| `analysis` | `BarChart3` | `/analysis` | Analysis |

## 스타일
```
funky-ui 의 SideNav (크림 바탕, 오른쪽 2px 선)
hidden md:flex flex-col
메뉴 줄의 칠 · 골라짐은 SideNav 가 맡습니다
```

## 활성 상태
```
활성 메뉴:  검정 면 + 흰 글자 + 그림자 (SideNav.Item 의 active)
비활성:     hover 때 옅은 면
```

## 하단 시스템 상태 패널
- 서버 연결 상태 표시 (마지막 업데이트 시간)
- `lastUpdated` 타임스탬프 기반
- `bg-black/5 border-t-2 border-black` 스타일
