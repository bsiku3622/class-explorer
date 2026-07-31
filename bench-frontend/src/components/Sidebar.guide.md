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
fixed left-0 top-16  z-40
hidden md:flex flex-col
w-64  bg-retro-bg
border-r-2 border-black
```

## 활성 상태
```
활성 메뉴:  bg-black text-white scale-[1.02] shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]
비활성:     hover:bg-retro-accent-light
```

## 하단 시스템 상태 패널
- 서버 연결 상태 표시 (마지막 업데이트 시간)
- `lastUpdated` 타임스탬프 기반
- `bg-black/5 border-t-2 border-black` 스타일
