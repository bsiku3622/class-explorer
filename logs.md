# Logs

## 2026-03-17 — Data Management 아코디언 + 가이드북 초성 검색 안내

- 변경 파일: `backend/admin_router.py`, `frontend/src/pages/AdminPage.tsx`, `frontend/src/pages/SettingsPage.tsx`, `backend/CLAUDE.md`
- 요약: Admin에 Data Management 아코디언 추가 (Students/Teachers/Subjects 탭). 학생 이름 인라인 편집, 교사 이름 일괄 변경, Subject Aliases 통합. 가이드북에 초성 검색(ㅈㄱ 등) 설명 추가.

## 2026-03-17 — 과목 별칭(alias) 검색 시스템

- 변경 파일: `backend/models.py`, `backend/main.py`, `backend/admin_router.py`, `frontend/src/lib/searchEngine.ts`, `frontend/src/pages/AdminPage.tsx`, `backend/CLAUDE.md`
- 요약: `SubjectAlias` 테이블 추가 (subject + alias UniqueConstraint). GET / 응답에 `aliases` 필드 포함. Admin에 `GET/PUT /admin/subjects` 엔드포인트 추가. searchEngine의 sectionPool에 aliases 포함. AdminPage에 Subject Aliases 아코디언 섹션 추가 (과목명 필터 + 인라인 편집 UI).

## 2026-03-17 — Browse/Settings 탭 재편 + 가이드북

- 변경 파일: `pages/BrowsePage.tsx` (신규), `pages/SettingsPage.tsx` (신규), `pages/SearchPage.tsx`, `App.tsx`, `components/Sidebar.tsx`, `components/BottomNav.tsx`
- 요약: Students+Teachers 통합 → `/browse` (모드 토글 + 학년 필터). `/settings`에 기능 가이드북(검색 문법, prefix, 논리 연산자, Browse, Rooms 설명) + About 추가. SearchPage Help 버튼 제거. 사이드바/하단 메뉴 Search/Rooms/Analysis/Browse/Settings로 재편.

## 2026-03-17 — Admin 대시보드 구현

- 변경 파일: `backend/admin_router.py` (신규), `backend/models.py`, `backend/auth.py`, `backend/auth_router.py`, `backend/main.py`, `backend/create_user.py`, `pages/AdminPage.tsx` (신규), `App.tsx`, `components/Navigation.tsx`, `components/Sidebar.tsx`
- 요약: 관리자 전용 API(`/admin/*`) + UI 구현. User에 `is_admin`, Session에 `ip_address` 추가. 서버 기동 시 컬럼 자동 마이그레이션. Admin 유저는 Sidebar에 Admin 메뉴 노출, `/admin` 라우트 접근 가능. 기능: 유저 생성/삭제/admin 권한 토글, 세션 목록(IP/기기/만료일) + 강제 종료, 데이터 재수집(KSAIN API).

## 2026-03-17 — 배포 환경 분리 (VITE_API_BASE_URL, CORS)

- 변경 파일: `frontend/src/lib/api.ts` (신규), `frontend/.env` (신규), `frontend/src/App.tsx`, `frontend/src/pages/LoginPage.tsx`, `backend/main.py`, `frontend/CLAUDE.md`, `backend/CLAUDE.md`
- 요약: axios 인스턴스(`src/lib/api.ts`) 추가, `VITE_API_BASE_URL` 환경변수로 baseURL 분기(미설정 시 `/api` 프록시). 백엔드에 CORS 미들웨어 추가(`CORS_ORIGINS` 환경변수). Netlify 배포 시 두 환경변수만 설정하면 됨.

## 2026-03-17 — 프론트엔드 로그인 UI 구현

- 변경 파일: `pages/LoginPage.tsx` (신규), `App.tsx`, `components/Navigation.tsx`, `frontend/CLAUDE.md`, `frontend/component-guide.md`, `frontend/src/App.guide.md`
- 요약: 로그인 페이지(전체화면, PC/모바일 대응) 추가. App.tsx에 sessionToken 상태 관리 + handleLogin/handleLogout + 401 자동 로그아웃 처리. Navigation에 Logout 버튼(모바일 아이콘만, PC 텍스트+아이콘) 추가.

## 2026-03-17 — 세션 기반 인증으로 전환 (1계정 1세션)

- 변경 파일: `backend/auth.py`, `backend/auth_router.py`, `backend/models.py`, `backend/api-guide.md`, `backend/CLAUDE.md`, `requirements.txt`
- 요약: JWT 제거 → session_token(랜덤 48바이트) DB 저장 방식으로 전환. 1계정 1세션 강제(로그인 시 기존 세션 전부 삭제), 만료 30일. `/auth/refresh` 엔드포인트 삭제. Session 컬럼 `refresh_token`→`session_token` + `expires_at` 추가. **DB 마이그레이션 필요** (sessions 테이블 드롭 후 재기동).

## 2026-03-17 — JWT 인증 시스템 구현

- 변경 파일: `backend/models.py`, `backend/main.py`, `backend/auth.py` (신규), `backend/auth_router.py` (신규), `backend/create_user.py` (신규), `requirements.txt` (신규), `backend/CLAUDE.md`, `backend/api-guide.md`
- 요약: JWT Access(30분)+Refresh(30일) 기반 인증 추가. User/Session 테이블 신설, 계정당 최대 2세션(초과 시 가장 오래된 것 자동 삭제), `GET /` 인증 보호. `python -m backend.create_user <username> <password>`로 계정 생성.

## 2026-03-17 — Teaching Load / Classroom Utilization 간격 수정

- 변경 파일: `pages/AnalysisPage.tsx`
- 요약: 두 아코디언 감싸는 grid gap-8 → gap-4 md:gap-6, 부모 flex gap과 통일


## 2026-03-17 — 아코디언 내부 더 촘촘하게

- 변경 파일: `SubjectAccordionItem.tsx`, `SectionCard.tsx`
- 요약: 아코디언 내부 패딩 px-4 pb-4 pt-4, space-y-6, teachers mb-4 / SectionCard 타이틀 text-base px-3 py-1, space-y-2.5, 메타 space-y-1.5로 압축


## 2026-03-17 — Analysis 상단 3개 차트 vertical 레이아웃으로 통일

- 변경 파일: `pages/AnalysisPage.tsx`
- 요약: Subjects by Enrollment, Weekly Periods, Subject Count에서 layout="horizontal" 제거 → Teaching Load/Classroom Utilization과 동일한 vertical 디자인 적용


## 2026-03-17 — 전체 UI 패딩/여백 압축

- 변경 파일: `SubjectAccordionItem.tsx`, `SectionCard.tsx`, `molecules/AccordionSection.tsx`, `pages/AnalysisPage.tsx`, `pages/SearchPage.tsx`
- 요약: 아코디언 내부(pt-10 pb-12→pt-5 pb-6, space-y-12→space-y-8, mb-12→mb-6), SectionCard gap-8→gap-4~6, AccordionSection p-6→p-4, AnalysisPage gap-8→gap-4~6, SearchPage mt-6→mt-4


## 2026-03-17 — BarChartRow 모바일 깨짐 수정

- 변경 파일: `components/molecules/BarChartRow.tsx`
- 요약: horizontal 레이아웃에서 `w-56` 고정 라벨이 모바일 화면 폭 초과 → 모바일 flex-col(라벨 위/바 아래), sm+ 에서 기존 가로 레이아웃 유지


## 2026-03-17 — Filter 버튼 학생수 카운트 제거

- 변경 파일: `components/FilterSection.tsx`
- 요약: 필터 버튼에서 `({count})` 제거 → 버튼 폭 축소로 모바일 1줄 배치 개선


## 2026-03-17 — Filter 모바일 1줄 가로스크롤, N명표시중 마진, SearchInput shadow 통일, Feature태그 제거, subtitle 단축, 물음표버튼 우측배치

- 변경 파일: `FilterSection.tsx`, `pages/StudentsPage.tsx`, `pages/TeachersPage.tsx`, `atoms/SearchInput.tsx`, `molecules/PageHeader.tsx`, `pages/SearchPage.tsx`, `pages/AnalysisPage.tsx`, `pages/RoomsPage.tsx`, `pages/StudentsPage.tsx`, `pages/TeachersPage.tsx`
- 요약: Filter 모바일에서 overflow-x-auto 단일행(shrink-0+whitespace-nowrap), N명표시중 -mt-4→-mb-4, SearchInput shadow opacity 0.1→0.2, Feature태그 전부 제거, subtitle 1~2단어 축약, 물음표버튼 plain button 정사각형+우측 고정

## 2026-03-17 — 모바일 반응형 피드백 반영

- 변경 파일: `atoms/SearchInput.tsx`, `pages/SearchPage.tsx`, `components/FilterSection.tsx`, `pages/StudentsPage.tsx`, `components/SubjectAccordionItem.tsx`, `pages/RoomsPage.tsx`, `molecules/AccordionSection.tsx`
- 요약: SearchInput 폰트 크기 축소(placeholder 깨짐 수정), FilterSection 항상 flex-row/Refresh 우측 배치/className prop 추가, SubjectAccordionItem 모바일 flex-col, Rooms 방 버튼 flex-wrap 2줄, AccordionSection 타이틀 폰트 반응형

## 2026-03-17 — 모바일 반응형 디자인 적용

- 변경 파일: `components/BottomNav.tsx` (신규), `App.tsx`, `components/TimetableGrid.tsx`, `components/SearchResultDisplay.tsx`, `components/molecules/PageHeader.tsx`, `pages/RoomsPage.tsx`, `pages/AnalysisPage.tsx`
- 요약: 모바일용 하단 네비게이션(BottomNav) 추가, 시간표 그리드에 overflow-x-auto 적용, PageHeader/SearchResultDisplay 텍스트·패딩 반응형 조정
