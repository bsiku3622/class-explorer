# UploadPage

로그인 사용자가 과목 자료를 올리고 자신의 검수 상태를 확인하는 페이지입니다.

- 경로: `/upload`, 사이드바와 모바일 More에서 접근합니다.
- 선택된 학기의 개설 과목을 반드시 고릅니다.
- PDF, PNG, JPG/JPEG, WEBP, DOCX, PPTX, XLSX, ZIP을 최대 20개 선택합니다.
- ZIP의 실제 검사·추출 제한은 backend가 최종 책임집니다.
- My Uploads에서 pending/approved/rejected와 거절 사유를 확인합니다.
- pending과 approved metadata를 수정할 수 있고, approved 수정은 재검수됩니다.
- pending/rejected만 철회할 수 있습니다.
