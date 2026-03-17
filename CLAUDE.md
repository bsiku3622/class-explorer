# CLAUDE.md

## Project

KSA 학생/교사/강의실 기반 수업 탐색 웹 앱.  
**Stack**: React 19 + TypeScript + Vite + Tailwind v4 + HeroUI / FastAPI + SQLAlchemy (SQLite)

---

## Commands

```bash
# Frontend (frontend/)
npm run dev       # Vite dev server — /api → localhost:8000 프록시
npm run build     # TypeScript check + Vite build
npm run lint      # ESLint

# Backend (repo root)
uvicorn backend.main:app --reload   # FastAPI (port 8000)
python -m backend.parser_run        # KSAIN API → SQLite 동기화
```

테스트 미구현. 검증은 `npm run build` + `npm run lint` 통과로 대체. **테스트 파일 생성 금지.**

---

## Architecture

```
KSAIN API → parser_run.py → ksa_timetable.db
                                  ↓
                         FastAPI GET /  (단일 엔드포인트)
                                  ↓
                 App.tsx — localStorage 캐시 (1h TTL)
                                  ↓
                 searchInClient() — 완전 클라이언트 사이드
```

| 파일                      | 역할                                                                            |
| ------------------------- | ------------------------------------------------------------------------------- |
| `App.tsx`                 | 전역 상태 + 라우터 + fetch + 검색 오케스트레이터 (context/store 없음)           |
| `src/lib/searchEngine.ts` | 검색 전체 로직 (prefix 파싱, 불린 연산, 초성 매칭)                              |
| `src/utils.ts`            | `DAY_MAP`, `DAYS_ORDER`, `PERIODS`, `extractSearchTerms()`, `getStudentColor()` |

**View Mode**: `isConsolidatedView = (searchMode !== 'general') || isLogicalSearch`

- **Consolidated**: prefix·논리 검색 → `EntityCard` + `TimetableGrid` + 과목 목록
- **Grid**: 일반 키워드 복수 엔티티 → `EntityCard` 격자

---

## Conventions

- 비즈니스 로직은 `lib/` 또는 커스텀 훅으로 분리. 컴포넌트 내 직접 작성 금지
- `DAY_MAP`, `DAYS_ORDER`, `PERIODS` — `utils.ts`에서 import, 로컬 재정의 금지
- 하이라이트 키워드 추출: `extractSearchTerms()` 단일 사용
- `searchTerm` ↔ URL `?q=` 동기화는 `App.tsx`에서만 관리
- 한글 IME Enter 중복 방지: `e.nativeEvent.isComposing` 체크 필수
- Tooltip: `isDisabled={!isModifierPressed}` (Cmd/Ctrl 시에만 노출)

---

## Design Rules

- `border-2 border-black` — 모든 카드/버튼
- Hard shadow: `shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]` → hover 시 `translate-x-1 translate-y-1`로 숨김
- 선택된 버튼: `scale-105` + hover 시 shadow만 숨김 (translate 없음)
- `transition-all duration-100`
- atom 컴포넌트 인라인 재구현 금지: `RetroButton`, `RetroCard`, `RetroSubTitle`, `StudentBadge` 사용
- `RetroSubTitle` 스타일 고정: `text-sm font-bold text-black/40 uppercase tracking-widest`
- 학생 색상: 반드시 `getStudentColor()` 사용 (23=Purple, 24=Orange, 25=Green, 26=Cyan)
- HeroUI 전역 `border-radius: 0` 오버라이드 (`index.css`) — 건드리지 말 것
- Tailwind v4 `@theme` / `@custom-variant` LSP 경고는 정상 — 수정 시도 금지

---

## Rules — 작업 절차

### 시작 전

1. 작업을 `/tasks.md`에 추가: `- [ ] <작업 내용>`
2. 수정할 파일의 가이드 문서 먼저 읽기

### 완료 후

3. 수정한 파일의 가이드 문서 업데이트
4. `/tasks.md` 체크: `- [x] <작업 내용>`
5. `/logs.md`에 요약 추가:

```
   ## YYYY-MM-DD — <작업 제목>
   - 변경 파일: `파일명`
   - 요약: <한두 줄>
```

`/logs.md` 날짜 역순 | `/tasks.md` 최신 항목 아래에 추가

---

## 참고 문서

| 작업 유형     | 문서                          |
| ------------- | ----------------------------- |
| 디자인 변경   | `frontend/design-guide.md`    |
| 컴포넌트 추가 | `frontend/component-guide.md` |
| API 수정      | `backend/api-guide.md`        |
