# materialsApi.ts

인증된 과목 자료실 API를 한곳에 모읍니다. 파일 endpoint는 Bearer 인증이 필요하므로
preview와 download 모두 axios로 Blob을 받은 뒤 브라우저 임시 URL을 사용합니다.

- 승인 자료는 학기별 메모리 cache를 사용합니다.
- 관리자 승인·삭제 시 cache 전체를 비웁니다.
- 업로드는 multipart이며 여러 파일과 ZIP bundle을 지원합니다.
- category의 화면 표기는 `MATERIAL_CATEGORY_LABELS`가 유일한 출처입니다.
