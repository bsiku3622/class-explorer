# Logs

## 2026-07-29 — 수강 변경 탐색(Trade) 및 유사도 검색

- 변경 파일: `frontend/src/lib/tradeEngine.ts` (신규), `frontend/src/lib/features.ts` (신규), `frontend/src/pages/TradePage.tsx` (신규), `frontend/src/components/SectionsTimetable.tsx` (신규), `frontend/src/lib/searchEngine.ts`, `frontend/src/App.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/BottomNav.tsx`, `frontend/src/types/index.ts`
- 요약: 분반 이동·드랍·추가신청을 한 화면에서 처리하는 `/trade` 추가. 과목마다 유지/이동/드랍을 지정하고 추가 과목은 분반까지 고정할 수 있으며, 시간 슬롯이 겹치지 않는 조합을 백트래킹으로 찾아 나열합니다(상한 200, 변경 건수 오름차순). 조합을 누르면 적용 후 시간표를 미리 보여줍니다. 드랍한 과목은 빨간색으로 표시되고 목록 하단으로 내려가며, 드랍으로 비는 시간에 들어갈 수 있는 과목을 따로 제시합니다. 과목 카드를 펼치면 해당 과목 전 분반을 한 그리드에서 비교할 수 있고 충돌하는 분반은 회색 처리됩니다. 검색은 `fuzzyMatch`를 도입해 별칭 등록 없이 "정3"으로 "정보과학3"을 찾습니다 — 서브시퀀스 매칭에 구간 길이 제약(`검색어×3+2`)을 걸어 오탐을 억제했습니다. 기능 전체는 `TRADE_FEATURE.enabled` 한 줄로 끌 수 있고 2026-2에서만 노출됩니다. 정원 정보가 없어 시간 충돌만 판정합니다.
- 후속 10: 충돌이 조용히 지나가던 문제 수정 — (1) 충돌 판정 기준을 `effectiveSchedule`(드랍 제외 + 이동 반영 + 확정된 추가 포함)로 통일해, 이동끼리·추가끼리 부딪히는 경우도 잡습니다. (2) 색 우선순위에서 파랑(이동)이 주황(충돌)을 덮어 가리던 것을 충돌 우선으로. (3) "자동"으로 맡긴 항목이 있으면 첫 조합을 자동으로 미리보기 — 자동인데 시간표가 그대로여서 아무 일도 안 일어난 것처럼 보였습니다.
- 후속 9: 색 규칙 정리 — 같은 의미에 다른 색을 쓰던 곳을 통일(분반 그리드와 배지 목록이 "갈 수 있는 분반"을 각각 시안·초록으로 칠하고 있었음). 정보 표시는 현재=시안·가능=초록·충돌=주황으로 공유하고, 이동은 `retro-accent5` 파랑으로 카드 배경까지 부여. accent1(청록)은 크림 배경 위에서 연두로 보여 추가(초록)와 겹쳤습니다.
- 후속 8: 시간표에서 이동을 파랑으로 분리(빠짐=핑크 · 이동=파랑 · 추가=초록 · 충돌=주황). 선택된 버튼이 카드 색과 무관하게 검정이던 것을 카드 색(초록·시안·핑크)으로 맞추고, 이동 카드 배경은 흰색으로 — 시안 반투명이 크림 배경 위에서 연두로 보여 추가 카드와 헷갈렸습니다.
- 후속 7: 분반 이동을 직접 고를 수 있게 개선 — "이동"이 조합 탐색 스위치 역할만 해서 눌러도 반응이 없어 보이던 문제. 이제 이동을 켜면 분반 버튼(자동/1/2/…)이 나타나고, 고르면 시간표에 즉시 반영됩니다(초록=이동 후, 주황=밀려나는 과목). `PlanRequest.moveTargets`로 탐색 후보를 고정 분반으로 제한합니다.
- 후속 6: 분반 검색에 콤마 목록 지원 — `체육4/2,3`으로 여러 분반을 한 번에. 분반 여러 개인 카드를 누르면 `생활체육2/1,4`로 검색됩니다. About 가이드북에 유사도·분반 검색 안내 추가.
- 후속 5: 통합 뷰에서 과목·분반을 누르면 `체육4(4)/4`처럼 잘못된 검색어가 만들어지던 버그 수정 — `formatSubjectWithSection` 출력의 뒤쪽 괄호만 분반으로 파싱하도록 변경(과목명의 숫자·괄호를 분반으로 오인하지 않게). 분반이 여럿이면 과목명으로만 검색합니다.
- 후속 4: 드랍한 과목이 충돌 판정에서 빠지지 않던 버그 수정 — `activeSchedule`(드랍 제외 시간표)을 만들어 추가 후보·분반 배지 계산에 일괄 적용. 카드 안 버튼은 텍스트까지 카드 색(핑크/초록/주황)을 따르게 통일.
- 후속 3: 충돌 분반을 회색이 아니라 핑크로 칠하고(선택 불가처럼 보이던 문제), 충돌을 감수하고 분반을 고정하면 부딪히는 기존 과목을 시간표에서 주황으로 표시. 추가 과목이 들어갈 분반이 하나도 없을 때 카드에 이유를 적고, 분반 버튼 툴팁에 충돌 과목명을 넣었습니다. 추가 과목 카드는 목록 맨 위로.
- 후속 2: 계획을 localStorage에 자동 저장·복원. 교환 상대 찾기 추가 — 상대가 내 목표 분반을 듣고 있고 내 자리로 와도 충돌이 없는 학생만 골라, 조합 선택 시 목록으로 보여줍니다(`buildStudentIndex`로 학생별 시간표를 한 번에 만들어 재조회를 피함). 분반 목록에도 분반별 교환 상대 수를 표시. 검색은 분반 지정(`체4/5`)에도 유사도를 적용. 분반 그리드는 호버 시 하단 바에 상세를 띄우고 내 분반만 `retro-accent1`로 진하게, 카드·버튼 테두리를 검정으로 통일, 학기 전환 버튼을 Logout 버튼과 같은 스타일로 맞췄습니다.
- 후속: 조합을 고르기 전에도 지정한 드랍·추가가 왼쪽 시간표에 즉시 반영되도록 수정. 빠지는 과목은 빨강, 들어오는 과목은 초록으로 칠하고 범례를 붙였습니다(`TimetableGrid`에 `colorFor` prop 추가 — 기존 사용처는 영향 없음). 빠지는 과목을 지우지 않고 남겨둬 어느 시간이 비는지 보이게 했고, 분반을 정하지 않은 추가 과목은 그리지 않습니다.

## 2026-07-29 — KEIS API 전환 및 학기별 데이터 구조 도입

- 변경 파일: `backend/parser.py`, `backend/parser_run.py`, `backend/models.py`, `backend/migrations.py` (신규), `backend/terms.py` (신규), `backend/main.py`, `backend/admin_router.py`, `frontend/src/App.tsx`, `frontend/src/components/Navigation.tsx`, `frontend/src/components/TermSwitcher.tsx` (신규), `frontend/src/types/index.ts`
- 요약: 데이터 소스를 `api.ksain.net`에서 `keis.ksa.hs.kr/restapi/v1/schedule/{stuId}/{year}/{semester}`로 전환. 응답 포맷은 동일하나 교시를 배열 인덱스가 아닌 `kyosi` 필드로 읽도록 파서 재작성(12교시 대응, 강의실 `"배정중"` 처리, 대표 강의실 선정). `Class`에 `year`/`semester`를 추가해 학기별 데이터를 한 DB에 공존시키고, `UniqueConstraint`를 `(subject, section, teacher, year, semester)`로 확장 — SQLite 제약 변경 불가로 `migrations.py`에서 테이블 재생성(id 보존해 FK 유지, 기존 데이터는 2026-1로 지정). `parser_run.py`는 학기 단위 원자적 교체 방식으로 재작성(전원 수집 후 반영, 재시도 2회, 요청 실패 과반 시 중단, `students.txt` 파괴적 덮어쓰기를 `--prune` 옵션으로 분리). `GET /`에 `year`/`semester` 쿼리와 `GET /terms` 추가, admin의 teachers/subjects도 학기 필터. 프론트는 `TermSwitcher`로 학기 전환하며 캐시 키를 학기별로 분리하고 선택 학기를 `ksa_selected_term`에 보존. 2026-2 수집 결과 342명 동기화(237분반), 2026-1(357명·247분반) 보존 확인.

## 2026-03-17 — 효율성 수정 3건

- 변경 파일: `backend/auth_router.py`, `frontend/src/lib/searchEngine.ts`, `frontend/src/pages/AnalysisPage.tsx`
- 요약: (1) Rate Limiter `_maybe_cleanup()` 추가 — 5분 주기로 만료된 IP 항목 정리해 메모리 누수 방지 (threading.Lock 이중 체크). (2) `getChosung()` 모듈 레벨 `_chosungCache` Map 추가 — 동일 문자열 재계산 제거. (3) AnalysisPage `allClassesData` 순회 5개 useMemo → `periodStats`·`subjectStats` 2개로 통합 (주당 교시 분포 + 연도별, 수강 과목 수 분포 + 연도별 + 과목별 연도 분포 각 1회 순회).

## 2026-03-17 — 배포 설정 및 가이드 작성

- 변경 파일: `frontend/src/lib/api.ts`, `deploy-guide.md` (신규)
- 요약: api.ts 주석에 실제 배포 URL 반영 (classes_api.bsiku.dev). nginx + certbot + systemd 기반 배포 가이드 작성.

## 2026-03-17 — 보안 취약점 추가 수정 (SEC-T01~T04, T06, T13, T14)

- 변경 파일: `backend/auth_router.py`, `backend/main.py`
- 요약: 타이밍 공격 방지(dummy bcrypt), Rate Limit IP 실제 추출(X-Forwarded-For), CSP 헤더 추가, Cache-Control(no-store), Retry-After 헤더, CORS allow_methods/headers 최소화.

## 2026-03-17 — 가이드 문서 전체 정비

- 변경 파일: `CLAUDE.md`, `backend/CLAUDE.md`, `backend/api-guide.md`, `frontend/CLAUDE.md`, `frontend/component-guide.md`, `frontend/src/App.guide.md`, `frontend/src/pages/AnalysisPage.guide.md`, `frontend/src/pages/RoomsPage.guide.md`, `frontend/src/components/SearchResultDisplay.guide.md`
- 요약: 현재 코드 상태 기준으로 모든 가이드 문서 최신화. 주요 변경: src/utils.ts→lib/utils.ts 경로 수정, 페이지 목록(BrowsePage/SettingsPage→/about), 라우팅 테이블, React.lazy 코드스플리팅, 보안 항목(headers/rate-limit/validation), API 응답에 aliases·is_admin 필드 추가, AnalysisPage 충돌감지·teacherLoadDistribution, RoomsPage onRoomSearch prop 반영.

## 2026-03-17 — 로컬 HTTPS 설정 (mkcert + Vite)

- 변경 파일: `frontend/vite.config.ts`, `frontend/.gitignore`, `.gitignore`
- 요약: mkcert로 localhost 인증서 생성, vite.config.ts에 https 옵션 + proxy target https 전환, .gitignore에 *.pem 추가.

## 2026-03-17 — 보안 감사 및 수정 (SEC-01 ~ SEC-15)

- 변경 파일: `backend/main.py`, `backend/auth_router.py`, `backend/admin_router.py`, `requirements.txt`
- 요약: 15개 보안 항목 전수 검사. 실제 수정된 취약점 5건:
  - [SEC-07] 입력값 검증: 모든 Pydantic 스키마에 max_length, pattern, Literal 검증 추가
  - [SEC-09] stderr 노출: sync 실패 시 내부 에러를 클라이언트에 노출하던 것 → server log only
  - [SEC-10] 보안 헤더: SecurityHeadersMiddleware 추가 (X-Content-Type-Options, X-Frame-Options 등)
  - [SEC-11] Rate Limiting: /auth/login IP당 60초 10회 제한 구현 (429 반환, 성공 시 초기화)
  - [SEC-14] Dependency: requirements.txt 최소 버전 고정 (bcrypt>=4.0.0 등)
  - 안전 판정 10건: SQL Injection(ORM), Command Injection(하드코딩), XSS(React), CSRF(Bearer), 인증우회, IDOR, 파일업로드(없음), 비즈니스로직, Race Condition(SQLite), 에러처리

## 2026-03-17 — 교사 부하 시각화, 충돌 감지, 번들 스플리팅

- 변경 파일: `frontend/src/pages/AnalysisPage.tsx`, `frontend/src/components/SearchResultDisplay.tsx`, `frontend/src/App.tsx`, `frontend/vite.config.ts`
- 요약: Analysis에 Teacher Load Distribution 아코디언 추가 (교사별 담당 교시 수 분포 차트). 비교 그리드 충돌 시간대(주황) 강조 + 충돌 카운트 배지 표시. 논리 학생 검색 시 SearchResultDisplay에 충돌 경고 블록 추가. App.tsx 전체 페이지 React.lazy 전환 + Suspense 래퍼, vite.config에 manualChunks로 HeroUI/vendor 청크 분리.

## 2026-03-17 — 빈 교실 → 검색 연동

- 변경 파일: `frontend/src/pages/RoomsPage.tsx`, `frontend/src/App.tsx`
- 요약: Rooms 페이지에서 교실 선택 시 나타나는 "Search" 버튼 클릭으로 해당 강의실 room: 검색으로 이동. `onRoomSearch` prop 추가 및 App.tsx에서 `handleSearchSelect` 연결.

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
