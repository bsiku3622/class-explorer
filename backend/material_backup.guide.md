# material_backup.py

인증 자료 원본·preview와 해당 metadata가 든 SQLite DB snapshot을 같은
서버의 별도 디렉터리에 하나의 압축 파일로 남깁니다.

- 파일·제목·검수 상태 등 자료 변경이 없으면 새 snapshot을 만들지 않습니다.
- 최근 30개를 유지합니다.
- `.tmp` 격리 디렉터리는 backup에서 제외합니다.
- production에서는 systemd timer가 매일 실행합니다.
- 같은 디스크의 실수 복구용입니다. 디스크 장애 대비는 향후 외부 저장소 복제가 필요합니다.
