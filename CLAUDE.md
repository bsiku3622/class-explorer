# CLAUDE.md

## 프로젝트 개요

KSA(과학영재학교) 학생/교사/강의실 기반 수업 탐색 웹 앱.

**Stack**: React 19 + TypeScript + Vite + Tailwind v4 + HeroUI / FastAPI + SQLAlchemy (SQLite)

## Commands

### Frontend (`frontend/` 에서 실행)

```bash
npm run dev      # Vite dev server — /api → localhost:8000 프록시
npm run build    # TypeScript check + Vite build
npm run lint     # ESLint
```

### Backend (repo root에서 실행)

```bash
uvicorn backend.main:app --reload   # FastAPI (port 8000)
python -m backend.parser_run        # KSAIN API → SQLite 동기화
```

## Testing

테스트 미구현. 수정 후 `npm run build` + `npm run lint` 통과 여부로 검증.
**테스트 파일 생성 금지.**

## Architecture

### Data Flow

```
KSAIN API → parser_run.py → ksa_timetable.db (SQLite)
                                    ↓
                           FastAPI GET /  (단일 엔드포인트)
                                    ↓
                   App.tsx — localStorage 캐시 (1h TTL)
                                    ↓
                   searchInClient() — 완전 클라이언트 사이드
```

### 핵심 파일 역할

- **App.tsx** — 전역 상태 + 라우터 + fetch + 검색 오케스트레이터. context/store 없음, props로 하위 전달
- **`src/lib/searchEngine.ts`** — 검색 전체 로직 (prefix 파싱, 불린 연산, 초성 매칭)
- **`src/utils.ts`** — `DAY_MAP`, `DAYS_ORDER`, `PERIODS`, `extractSearchTerms()`, `getStudentColor()` 등 공유 상수/유틸

### View Mode 분기

`isConsolidatedView = (searchMode !== 'general') || isLogicalSearch`

- **Consolidated**: prefix 검색·논리 검색 → `EntityCard` + `TimetableGrid` + 과목 목록
- **Grid**: 일반 키워드 복수 엔티티 → `EntityCard` 격자

## Design Rules (design-guide.md 기준 — 절대 준수)

- `border-2 border-black` — 모든 카드/버튼
- Hard shadow: `shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]` → hover 시 `translate-x-1 translate-y-1`로 숨김
- 선택된 버튼: `scale-105` + hover 시 shadow만 숨김 (translate 없음)
- `transition-all duration-100`
- **atom 컴포넌트 인라인 재구현 금지**: `RetroButton`, `RetroCard`, `RetroSubTitle`, `StudentBadge` 사용
- `RetroSubTitle` 스타일 고정: `text-sm font-bold text-black/40 uppercase tracking-widest`
- 학생 색상은 반드시 `getStudentColor()` 사용 (23=Purple, 24=Orange, 25=Green, 26=Cyan)
- HeroUI 전역 `border-radius: 0` 오버라이드 (`index.css`) — 건드리지 말 것

## Key Conventions

- 비즈니스 로직은 `lib/` 또는 커스텀 훅으로 분리. 컴포넌트 내 직접 작성 금지
- 하이라이트 키워드 추출: `extractSearchTerms()` (utils.ts) 단일 사용
- `DAY_MAP`, `DAYS_ORDER`, `PERIODS` — utils.ts에서 import, 로컬 재정의 금지
- 한글 IME Enter 중복 방지: `e.nativeEvent.isComposing` 체크 필수
- Tooltip: `isDisabled={!isModifierPressed}` (Cmd/Ctrl 시에만 노출)

## ⚠️ 주의: 자주 실수하는 패턴

- `isConsolidatedView` 분기 변경 시 Consolidated/Grid **양쪽** 동작 확인 필수
- `searchTerm` ↔ URL `?q=` 양방향 동기화 로직은 App.tsx에서만 관리
- localStorage 캐시(1h TTL) 관련 수정 시 App.tsx 캐시 로직 전체 확인
- Tailwind v4 `@theme` / `@custom-variant` LSP 경고는 정상 — 수정 시도 금지

## ⚠️ 주의: 무조건 해야 하는 것 : 가이드 문서 수정

- 각 파일 수정 전 각 파일의 가이드 문서 읽기
- 각 파일 수정 후 각 파일 및 상위 가이드 문서 수정하기

## 참고 문서 (해당 작업 전 필독)

- `frontend/design-guide.md` — 디자인 변경 작업 전
- `frontend/component-guide.md` — 새 컴포넌트 추가 전
- `backend/api-guide.md` — API 수정 전
