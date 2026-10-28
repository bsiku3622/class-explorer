# MaterialsPage

선택 학기의 승인된 과목 자료를 검색·열람하는 자료실입니다.

- 경로: `/materials`
- `?subject=<subject_id>`로 과목 accordion에서 바로 필터된 상태로 진입합니다.
- backend 승인 자료와 2026-1 강의계획서를 한 화면에서 합칩니다.
- category·과목·검색어 필터는 브라우저에서 처리합니다.
- 인증 자료 preview/download는 `materialsApi`, 강의계획서는 `lib/syllabi.ts` 를 씁니다 — 둘 다 인증 헤더를 붙여
  Blob 으로 받습니다. 강의계획서도 예전엔 화면 번들의 asset URL 이었는데, 교사 연락처가 든 파일을 로그인 없이
  내주게 돼서 서버(`GET /syllabi`)로 옮겼습니다.
- 강의계획서 목록을 받는 동안은 개수 줄 오른쪽에 "불러오는 중", 받지 못하면 위쪽 알림 칸에 한 줄을 띄웁니다.
