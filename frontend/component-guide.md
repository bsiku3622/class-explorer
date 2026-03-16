# Component Guide

> [← Frontend Guide](CLAUDE.md) | 상세: [Atoms](component-guide-atoms.md) | [Molecules & Organisms](component-guide-organisms.md)

## Atoms (`src/components/atoms/`)
| 컴포넌트 | Props 요약 | 역할 |
|----------|-----------|------|
| `RetroButton` | `variant`, `size`, `isSelected`, `icon`, `onClick` | 물리 피드백 버튼 |
| `RetroCard` | `shadow` (sm/md/lg), `className` | 테두리+쉐도우 컨테이너 |
| `RetroFeatureTag` | `feature: string` | 우상단 절대위치 Feature 태그 |
| `RetroStatItem` | `label`, `value`, `unit`, `size` (sm/lg) | 숫자 통계 아이템 |
| `RetroSubTitle` | `title`, `icon` | 섹션 소제목 (표준 스타일 고정) |
| `StudentBadge` | `studentId`, `studentName`, `size`, `onClick` | 학번색 뱃지 |

## Molecules (`src/components/molecules/`)
| 컴포넌트 | Props 요약 | 역할 |
|----------|-----------|------|
| `PageHeader` | `tag`, `title`, `subtitle`, `icon`, `action`, `children` | 페이지 상단 헤더 블록 |
| `AccordionSection` | `title`, `icon`, `isOpen`, `onToggle`, `children` | 토글 가능한 패널 |
| `BarChartRow` | `label`, `value`, `maxValue`, `caption`, `layout`, `onLabelClick` | 바 차트 행 |

## Organisms (`src/components/`)
| 컴포넌트 | 역할 |
|----------|------|
| `Navigation` | 상단 고정 네비게이션 바 |
| `Sidebar` | 좌측 고정 사이드바 메뉴 |
| `FilterSection` | 학년 선택 필터 + 새로고침 |
| `SearchResultDisplay` | 검색 결과 표시 (통합/그리드 뷰) |
| `SectionCard` | 개별 분반 카드 (학생 배지, 교사, 강의실, 시간) |
| `SubjectAccordionItem` | 과목 아코디언 (분반 목록 토글) |
| `StatsCards` | 3열 통계 카드 (과목수, 분반수, 학생수) |
| `TimetableGrid` | 요일×교시 시간표 그리드 |
| `EntityCard` | 검색된 엔티티 카드 (학생/교사/강의실) |

## Pages (`src/pages/`)
| 페이지 | 경로 | 역할 |
|--------|------|------|
| `SearchPage` | `/` | 통합 검색 + 결과 표시 |
| `RoomsPage` | `/emptyroomfinder` | 형설관 빈 교실 탐색 |
| `AnalysisPage` | `/analysis` | 학사 데이터 통계 대시보드 |

## 상세 가이드
- [component-guide-atoms.md](component-guide-atoms.md) — Atoms props 상세 + 사용 예시
- [component-guide-organisms.md](component-guide-organisms.md) — Molecules/Organisms 상세

## 디자인 규칙
모든 컴포넌트는 [design-guide.md](design-guide.md)의 규칙을 따릅니다.
- `RetroButton`의 `isSelected`로 선택 상태 처리 (직접 className 조작 금지)
- `RetroSubTitle`로 소제목 표준 스타일 강제 유지
- `StudentBadge`로 학번색 자동 매핑 (색상 직접 하드코딩 금지)
