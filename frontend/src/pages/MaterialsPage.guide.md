# MaterialsPage

선택 학기의 승인된 과목 자료를 검색·열람하는 자료실입니다.

- 경로: `/materials`
- `?subject=<subject_id>`로 과목 accordion에서 바로 필터된 상태로 진입합니다.
- backend 승인 자료와 2026-1 정적 syllabus를 한 화면에서 합칩니다.
- category·과목·검색어 필터는 브라우저에서 처리합니다.
- 인증 자료 preview/download는 `materialsApi`, 정적 syllabus는 asset URL을 사용합니다.
