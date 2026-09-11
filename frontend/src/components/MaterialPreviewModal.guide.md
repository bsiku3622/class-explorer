# MaterialPreviewModal

인증이 필요한 자료 파일을 Blob으로 받아 PDF 또는 이미지를 표시하는 modal입니다.

- `target`: 인증 파일은 `fileId`, 정적 syllabus는 `url`을 줍니다. `null`이면 렌더링하지 않습니다.
- `onClose`: 닫기, 배경 클릭, Escape가 모두 호출합니다.
- Blob URL은 modal이 닫힐 때 반드시 revoke합니다.
- iframe에 backend URL을 직접 넣지 않습니다. iframe은 Bearer header를 보낼 수 없습니다.
