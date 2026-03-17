# Tasks

- [x] 모바일 반응형 디자인 적용: BottomNav, 레이아웃 조정, 텍스트/패딩 반응형
- [x] JWT 인증 시스템 구현: SQLite User/Session 테이블, 기기당 최대 2세션, admin CLI
- [x] 세션 기반 인증으로 전환: JWT 제거, 1계정 1세션, session_token DB 조회
- [x] 프론트엔드 로그인 UI 구현: LoginPage, 인증 상태 관리, 로그아웃 버튼 (PC/모바일)
- [x] 배포 환경 분리: VITE_API_BASE_URL 환경변수, axios 인스턴스, 백엔드 CORS 설정
- [x] Admin 앱 구현: 사용자/세션/데이터 관리 UI + 백엔드 admin 엔드포인트
- [x] Browse/Settings 탭 재편: Students+Teachers→Browse, 가이드북 포함 Settings 탭 추가
- [x] 과목 별칭(alias) 시스템: SubjectAlias 모델, admin CRUD 엔드포인트, 검색 엔진 통합, Admin UI
- [x] Data Management 아코디언: 학생 이름 편집, 교사 이름 변경(전체 일괄), Subject Aliases 통합
- [x] 백엔드 GET / 쿼리 개선: N+1 → joinedload/selectinload로 쿼리 수 최소화
- [x] Sync 결과 상세: parser_run 완료 후 추가/수정/삭제 레코드 수 반환 및 표시
- [x] 검색 히스토리: 최근 검색어 localStorage 저장, 검색창 포커스 시 드롭다운 표시
- [x] URL 공유: 현재 검색 URL 클립보드 복사 버튼
- [x] 빈 교실 → 검색 연동: Rooms 페이지 교실 클릭 시 해당 강의실 Search로 이동
- [x] 교사 부하 시각화: Analysis 페이지에 교사별 주당 담당 교시 수 차트 추가
- [x] 충돌 감지: student:A & student:B 검색 시 공통 수업 외 시간 충돌 수업도 표시
- [x] 번들 사이즈 개선: dynamic import로 페이지별 코드 스플리팅 (HeroUI 청크 분리)
- [x] 로컬 HTTPS: mkcert + Vite https 설정
- [x] 가이드 문서 정비: 전체 .guide.md 및 CLAUDE.md 현재 코드 기준 최신화
- [x] 효율성 수정: Rate Limiter 메모리 누수 정리, chosung 캐싱, AnalysisPage useMemo 5→2 통합

## Security Audit
- [x] [SEC-01] SQL Injection: ORM 파라미터화 쿼리 검증 + LIKE wildcard 분석 → 안전 (ORM 파라미터화, LIKE wildcard는 admin 전용으로 실질적 위협 없음)
- [x] [SEC-02] Command Injection: subprocess 실행 코드 분석 및 검증 → 안전 (하드코딩 명령, shell=False, user input 미전달)
- [x] [SEC-03] XSS: React 프론트엔드 + API 응답 출력 분석 → 안전 (dangerouslySetInnerHTML 없음, React 자동 이스케이프, 백엔드 JSON-only)
- [x] [SEC-04] CSRF: Bearer 토큰 인증 구조 취약점 분석 → 안전 (Bearer 헤더 방식, 쿠키 미사용, 브라우저 자동 전송 불가)
- [x] [SEC-05] 인증 우회: 모든 endpoint 보호 여부 검증 → 안전 (모든 endpoint Depends(get_current_user/admin), 만료 세션 자동 삭제)
- [x] [SEC-06] IDOR/인가 취약점: resource ownership 체크 검증 → 안전 (세션 삭제 ownership 체크, admin role 체크, 자기 자신 보호)
- [x] [SEC-07] 입력값 검증: username/password/aliases 길이·형식 제한 추가 → 수정 (max_length, pattern 검증, device_type Literal, q max_length=100)
- [x] [SEC-08] 파일 업로드 취약점: 기능 존재 여부 확인 → 해당없음 (파일 업로드 endpoint 없음)
- [x] [SEC-09] 비밀정보 노출: sync stderr 클라이언트 노출 수정 → 수정 (stderr → server log only, 클라이언트에 generic 메시지)
- [x] [SEC-10] 보안 헤더: X-Content-Type-Options, X-Frame-Options, Referrer-Policy 추가 → 수정 (SecurityHeadersMiddleware 추가, HSTS env var 조건부)
- [x] [SEC-11] Rate Limiting: /auth/login 브루트포스 방어 구현 → 수정 (IP당 60초 10회 제한, 성공 시 카운터 초기화, 429 반환)
- [x] [SEC-12] 비즈니스 로직: sync 엔드포인트 어뷰즈 가능성 분석 → 안전 (admin 전용, 300초 timeout, subprocess 단일 실행)
- [x] [SEC-13] Race Condition: 동시 로그인 세션 생성 분석 → SQLite 직렬화로 안전. PostgreSQL 이전 시 FOR UPDATE 락 필요
- [x] [SEC-14] Dependency 취약점: requirements.txt 버전 미고정 수정 → 수정 (>=최소버전 명시, bcrypt>=4.0.0, python-multipart>=0.0.12)
- [x] [SEC-15] 로그/에러 처리: 민감정보 로그 기록 여부 확인 → 안전 (user enumeration 방지, SEC-09에서 stderr 노출 수정)
