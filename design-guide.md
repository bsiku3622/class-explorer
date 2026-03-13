# Visual Fail Finder Design Guide (Updated)

이 프로젝트는 **레트로 브루탈리즘(Retro Brutalism)** 스타일을 지향합니다. 강렬한 대비, 굵은 테두리, 하드 쉐도우(Hard Shadow), 그리고 물리적인 버튼 피드백이 핵심입니다.

## 1. Color Palette

### Core Colors
| Token | Value | Usage |
| :--- | :--- | :--- |
| `retro-bg` | `#f8f5f0` | 전체 배경색 (약간 누런 미색) |
| `retro-fg` | `#000000` | 기본 텍스트 및 메인 테두리 색상 |
| `retro-primary` | `#ff3e3e` | 강조 포인트 (Pink/Red), 통계 막대 그래프 기본색 |
| `retro-secondary` | `#1a1a1a` | 네비게이션 및 다크 요소 |
| `retro-accent-light` | `#fdf6e3` | 리스트/버튼 호버 시 배경색 |
| `retro-green` | `#22c55e` | 상태 성공, 빈 교실(Available) 표시 |
| `shadow-color` | `rgba(0,0,0,0.2)` | 모든 하드 쉐도우 및 반투명 요소의 표준 농도 |

### Academic Year Colors (Cohorts)
| Year | Color | Value |
| :--- | :--- | :--- |
| **23** | Purple | `#7828C8` |
| **24** | Orange | `#FC8200` |
| **25** | Green | `#00B327` |
| **26** | Cyan | `#00B5E7` |

---

## 2. Typography Standards

- **Font Family**: **Pretendard Variable** (Standard for KR/EN)
- **Fallback**: Pretendard, system-ui, sans-serif

### Section Subtitles (표준 서브타이틀)
모든 섹션의 소제목은 반드시 아래 규격을 따릅니다.
- **Style**: `text-sm font-bold text-black/40 uppercase tracking-widest flex items-center gap-2`
- **Icon**: `size={18} className="text-black/40"`

### Primary Headings
- **Large**: `text-4xl`~`text-6xl`, `font-black`, `tracking-tighter`, `uppercase`
- **Subtitle**: `text-sm`, `font-bold`, `text-black/40`, `uppercase`, `tracking-[0.2em]`

### Data Labels
- **Stats**: `text-sm font-black uppercase` (예: "14 PDS | 5 Sections")
- **Badges**: `text-[10px] font-black` (학생 칩 등)

---

## 3. UI Component Standards

### Borders & Dividers
- **Main Border**: `border-2 border-black` (카드, 버튼, 컨테이너)
- **Sub Divider**: `divide-black/10` 또는 `border-black/10` (격자 내부, 리스트 구분선)

### Shadows & Physical Animation (중요)
"그림자가 버튼 안으로 숨는 쫀득한 느낌"을 구현합니다.
- **기본 버튼**:
    - Normal: `shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]`
    - Hover: `shadow-[0_0_0_0_rgba(0,0,0,0.2)] translate-x-1 translate-y-1`
- **선택된 버튼 (Black background)**:
    - Normal: `scale-105 shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]`
    - Hover: **제자리 유지(no translate)**, `shadow-[0_0_0_0_rgba(0,0,0,0.2)]`
    - Active: `scale-100`
- **전환 속도**: `transition-all duration-100` (즉각적인 반응)

### Interactive Cards
- 기본 카드: `bg-white border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.2)]`
- 호버링 카드: `hover:-translate-y-1.5 transition-transform` (검색 결과 엔티티 카드 등)

---

## 4. Feature Specific Rules

### Timetable Grid (Empty Room / Compare)
- **Available (빈교실)**: `bg-retro-green/20`. 점유된 시간은 `bg-black/[0.07] grayscale`.
- **Selected**: `bg-black`.
- **Interaction**:
    - `cursor-help`: 툴팁이 있는 경우 적용.
    - **Compare Mode**: `Ctrl` 또는 `Cmd` 키를 누른 상태에서만 툴팁 노출 (`isDisabled={!isModifierPressed}`).
    - Shared Slots: 중앙에 `w-1.5 h-1.5 bg-retro-green rotate-45` 다이아몬드 인디케이터 표시.

### Analysis Statistics
- **Bar Charts**:
    - 높이: `h-5` 고정.
    - 색상: `bg-retro-primary` (Pink).
    - 호버: `group-hover:bg-[#ff7e7e]` (연핑크).
- **Show More**: 하단 중앙 배치, `text-xs font-black uppercase italic` 스타일 버튼.

### Search & Badges
- **Student Badge**: `Year Name` 형식 (예: "25 백재원").
- **Styling**: 해당 학번 색상의 `border-2`, `bg-[color]15` (15% 투명도), 글자색도 학번 색상 적용.
- **IME Fix**: 한글 입력 시 엔터 중복 처리 방지 (`e.nativeEvent.isComposing` 체크).

---

## 5. Atomic Components (Atoms)

일관된 디자인 시스템을 유지하기 위해 아래의 원자 단위 컴포넌트들을 `src/components/atoms/`에서 재사용합니다.

- **`RetroButton`**: 가이드라인의 "쫀득한 물리 피드백"이 내장된 표준 버튼.
    - `isSelected` props를 통해 선택된 상태(검은색 배경, 제자리 그림자 숨김) 자동 처리.
    - `size` (sm, md, lg)와 `variant` (primary, white, black) 지원.
- **`RetroSubTitle`**: 표준 서브타이틀 컴포넌트.
    - `text-sm font-bold text-black/40 uppercase tracking-widest` 스타일 강제 적용.
    - 아이콘과 텍스트 간의 표준 갭(`gap-2`) 유지.
- **`StudentBadge`**: 학번별 고유 색상이 적용된 학생용 뱃지.
    - `Year Name` 형식 자동 생성 (예: "25 백재원").
    - 학번 색상 기반의 테두리, 배경, 글자색 자동 매칭.

## 6. Page Structure

모든 주요 기능은 `src/pages/` 폴더 내에 독립된 페이지 컴포넌트로 관리합니다.
- `SearchPage`: 통합 검색 및 결과 표시 (Feature: Search Engine).
- `RoomsPage`: 형설관 빈 교실 찾기 지도 (Feature: Room Finder).
- `AnalysisPage`: 학사 데이터 통계 대시보드 (Feature: Data Analysis).

---
이 가이드라인은 디자인의 일관성을 유지하기 위한 **최종 기준**입니다. 모든 새로운 UI를 추가하거나 기존 UI를 수정할 때 반드시 이 수치를 준수하십시오.

