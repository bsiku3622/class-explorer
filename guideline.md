# KSA Visual Fail Finder 개발 가이드라인

## 1. Backend

### 목표
KSA 학생들의 시간표 데이터를 수집하여 정규화된 DB에 저장하고, 이를 효율적으로 조회할 수 있는 API를 제공한다.

### 기술 스택
- **Language**: Python 3.12+
- **Framework**: FastAPI
- **ORM**: SQLAlchemy
- **Database**: SQLite (`ksa_timetable.db`)

### 데이터 모델 (`models.py`)
- **Student**: 학생 정보 (학번 `stuId`, 이름 `name`)
- **Class**: 수업 정보 (과목명 `subject`, 분반 `section`, 교사 `teacher`, 강의실 `room`)
    - `UniqueConstraint('subject', 'section', 'teacher')` 적용으로 중복 방지.
- **Enrollment**: 학생-수업 간의 다대다(N:M) 관계를 정의하는 연결 테이블
    - `UniqueConstraint('stuId', 'classId')` 적용으로 학생의 중복 수강 등록 방지.

### 데이터 수집 및 동기화 (`parser.py`, `parser_run.py`)
1. **파싱 로직**: `ksain.net` 시간표 API의 JSON 응답 내부에 포함된 HTML `<br>` 데이터를 분석하여 과목, 분반, 교사, 강의실 정보를 추출한다.
2. **동기화 로직**: `students.txt`에 명시된 모든 학번을 순회하며 데이터를 동기화한다. 유효하지 않은 학번은 파일 및 DB에서 제거된다.

### API 엔드포인트 (`main.py`)
- `GET /classes_info?years=24,25`: 학번 필터링 기반 전체 수업 및 통계 데이터 반환.
- `GET /students_num_info`: 학번별(24, 25 등) 활성 학생 수 통계 반환.
- `GET /students_info`: 전체 학생의 상세 수강 목록 및 통계 데이터 반환.
- `GET /search/{keyword}`: 통합 검색(학생, 교사, 과목, 분반) 및 매칭된 인물(`entities`) 프로필 반환.
- `GET /teacher/{name}`: 특정 선생님의 담당 수업 및 수강생 명단 조회.
- `GET /student/{student_id}`: 학번 혹은 이름 기반 특정 학생의 수강 목록 조회.
- `GET /class/{class_id}`: 특정 분반의 상세 정보 및 수강생 명단 조회.

---

## 2. Frontend

### 목표
수집된 데이터를 기반으로 학번별 필터링, 검색, 그리고 수강생 명단을 직관적이고 감각적으로 시각화한다.

### 기술 스택
- **Framework**: React 19 (TypeScript) + Vite
- **UI Library**: HeroUI (NextUI) v2, Lucide React, Framer Motion
- **Styling**: Tailwind CSS v4 (Retro 테마)
- **State Management**: React Hooks (useState, useEffect, useMemo)

### 핵심 기능 및 UI 디자인 (`App.tsx`)
1. **Retro 테마 및 레이아웃**:
    - `index.css`의 Tailwind v4 `@theme` 블록을 활용한 컬러 시스템 (`retro-bg`, `retro-secondary` 등).
    - 모든 컴포넌트에 `rounded-none`, `border-2`, `shadow-retro` 스타일을 강제 적용하여 날카로운 레트로 감성 유지.
2. **고급 검색 시스템**:
    - **접두사 검색**: `teacher:성함` 입력 시 교사 전용 검색 수행.
    - **통합 검색 결과(Search Report Box)**: 검색 시 상단에 검색 통계와 매칭된 인물의 **Book Style 프로필** 카드 노출.
    - **자동 토글**: 리스트 내의 선생님 성함이나 학생 학번을 클릭하면 즉시 해당 키워드로 검색이 수행되며, 이미 검색 중인 항목을 다시 클릭하면 검색 취소.
3. **인터랙티브 시각화**:
    - **조합키(Cmd/Ctrl) 툴팁**: 조합키를 누른 상태에서 학생 배지나 선생님 성함에 호버 시 해당 인물의 전체 수강/담당 목록을 팝업으로 노출.
    - **하이라이트 및 그레이스케일**: 
        - 특정 인물 검색 시 일치하는 학생 배지만 색상을 유지하고 나머지는 `grayscale` 및 `opacity-20` 처리.
        - 선생님 이름 검색 시 아코디언 내 선생님 영역 강조.
4. **커스텀 아코디언**:
    - 애니메이션 지연 없는 즉각적인 개폐.
    - 상단에 선생님별 담당 분반 요약 정보 제공.
    - 과목별 전체 학생 수 및 분반 수 요약 칩 제공.

---

## 3. 실행 방법

### Backend
```bash
cd backend
python main.py
```

### Frontend
```bash
cd frontend
npm run dev
```
