# Component Guide

> [← Frontend Guide](CLAUDE.md) | 상세: [Atoms](component-guide-atoms.md) | [Molecules & Organisms](component-guide-organisms.md)

## Atoms (`src/components/atoms/`)
| 컴포넌트 | Props 요약 | 역할 |
|----------|-----------|------|
| `RetroButton` | `variant`, `size`, `isSelected`, `icon`, `onClick` | 물리 피드백 버튼 |
| `RetroCard` | `shadow` (none/sm/md/lg), `className` | 테두리+쉐도우 컨테이너. `none`은 바깥에서 그림자를 걸 때 (탭처럼 카드와 붙는 요소가 있는 경우) |
| `RetroFeatureTag` | `feature: string` | 우상단 절대위치 Feature 태그 |
| `RetroStatItem` | `label`, `value`, `unit`, `size` (sm/lg) | 숫자 통계 아이템 |
| `RetroSubTitle` | `title`, `icon` | 섹션 소제목 (표준 스타일 고정) |
| `StudentBadge` | `studentId`, `studentName`, `size`, `onClick` | 학번색 뱃지 |
| `CopyButton` | `text`, `label`, `title` | 클립보드 복사 + 1.5초간 "복사됨" 표시. https가 아닌 환경은 execCommand로 폴백 |
| `SearchInput` | `value`, `onChange`, `placeholder`, `className` | 검색 입력 필드 |
| `StudentCard` | `stuId`, `name`, `subjects`, `onClick` | 학생 프로필 카드 (툴팁용) |
| `TeacherCard` | `name`, `subjects`, `onClick` | 교사 프로필 카드 (툴팁용) |

## Molecules (`src/components/molecules/`)
| 컴포넌트 | Props 요약 | 역할 |
|----------|-----------|------|
| `PageHeader` | `tag`, `title`, `subtitle`, `icon`, `action`, `children` | 페이지 상단 헤더 블록 |
| `AccordionSection` | `title`, `icon`, `isOpen`, `onToggle`, `children` | 토글 가능한 패널 |
| `BarChartRow` | `label`, `value`, `maxValue`, `caption`, `layout`, `onLabelClick` | 바 차트 행 |

## Organisms (`src/components/`)
| 컴포넌트 | 역할 |
|----------|------|
| `Navigation` | 상단 고정 네비게이션 바 (`onLogoClick`, `onLogout`, `isAdmin`, `username`, `terms`, `currentTerm`, `onTermChange` props) |
| `TermSwitcher` | 학기 전환 토글 (`terms`, `current`, `onChange`). Navigation 전용 — 다크 배경 기준 스타일, 학기 1개면 미렌더 |
| `SectionsTimetable` | 한 과목의 **모든 분반**을 한 그리드에 겹쳐 표시 (`sections`, `currentSectionId`, `busySlots`). 칸에 분반 번호만 넣고, 호버하면 그리드 아래 바에 상세(교사·강의실·시간·인원·상태)를 띄웁니다. 내 분반 `retro-accent1` 진하게 / 이동 가능 연하게 / 충돌 회색 |
| `CourseGraph` | 교육과정 선수관계 그래프. 학과 하나 또는 `ALL_DEPARTMENTS`(전체 — 학과를 가로 레인으로). 이수 상태를 넘기지 않으면 구조만 그립니다. 과목을 누르면 그 과목과 직접 이어진 것만 남고 나머지는 흐려집니다 |
| `GoogleLoginButton` | 학교 구글 계정 로그인 버튼 (`onCredential`, `onError`). `VITE_GOOGLE_CLIENT_ID`가 없으면 아무것도 그리지 않습니다 |
| `GoogleLinkModal` | 옛 계정에 구글 계정을 붙이라고 요구하는 창. **닫을 수 없고** 로그아웃만 가능합니다 |
| `Sidebar` | 좌측 고정 사이드바 메뉴 |
| `FilterSection` | 학년 선택 필터 + 새로고침 |
| `SearchResultDisplay` | 검색 결과 표시 (통합/그리드 뷰) |
| `SectionCard` | 개별 분반 카드 (학생 배지, 교사, 강의실, 시간) |
| `SubjectAccordionItem` | 과목 아코디언 (분반 목록 토글) |
| `StatsCards` | 3열 통계 카드 (과목수, 분반수, 학생수) |
| `TimetableGrid` | 요일×교시 시간표 그리드. `colorFor(time)`로 칸마다 다른 색 지정 가능 (미지정 시 `color`) |
| `EntityCard` | 검색된 엔티티 카드 (학생/교사/강의실) |

## Pages (`src/pages/`)
| 페이지 | 경로 | 역할 |
|--------|------|------|
| `LoginPage` | (전체 앱 대체) | 로그인 폼, `onLogin(token)` 콜백 |
| `AdminPage` | `/admin` | 사용자/세션/데이터 관리 (admin 전용) |
| `SearchPage` | `/` | 통합 검색 + 결과 표시 |
| `RoomsPage` | `/emptyroomfinder` | 형설관 빈 교실 탐색 |
| `AnalysisPage` | `/analysis` | 학사 데이터 통계 대시보드 |
| `BrowsePage` | `/browse` | 학생·교사 목록 + 교육과정 그래프 (Students / Teachers / Courses 토글) |
| `TradePage` | `/trade` | 수강 변경 탐색 (2026-2 한정, features 플래그) |
| `ZamongPage` | `/zamong` | 교육과정 이수 현황 — 졸업 요건 진척도 + 평어·평점 + 선수관계 그래프 (학번 등록 필요) |
| `SettingsPage` | `/about` | 기능 가이드북 + About |

## 상세 가이드
- [component-guide-atoms.md](component-guide-atoms.md) — Atoms props 상세 + 사용 예시
- [component-guide-organisms.md](component-guide-organisms.md) — Molecules/Organisms 상세

## 디자인 규칙
모든 컴포넌트는 [design-guide.md](design-guide.md)의 규칙을 따릅니다.
- `RetroButton`의 `isSelected`로 선택 상태 처리 (직접 className 조작 금지)
- `RetroSubTitle`로 소제목 표준 스타일 강제 유지
- `StudentBadge`로 학번색 자동 매핑 (색상 직접 하드코딩 금지)
