# Visual Fail Finder Project Guidelines

## Design Standards
- **Adherence to Design Guide**: 모든 UI 작업은 프로젝트 루트에 있는 `design-guide.md`를 **절대적 기준**으로 삼아야 합니다.
- **Visual Consistency**: 새로운 컴포넌트를 만들거나 기존 컴포넌트를 수정할 때, 색상 팔레트(`rgba(0,0,0,0.2)` 등)와 애니메이션(`눌리는 효과`)이 가이드라인과 일치하는지 반드시 확인해야 합니다.
- **Atomic Components**: 반복되는 UI 패턴(Button, Card, Input)은 가급적 공통 컴포넌트로 분리하여 관리합니다.

## Architectural Integrity
- **URL Routing**: 새로운 기능 추가 시 `react-router-dom`을 사용하여 고유한 URL 경로를 할당합니다.
- **Search Logic**: 검색 엔진(`searchEngine.ts`)과 UI 컴포넌트 간의 데이터 필터링 로직이 일치해야 합니다.
- **Clean Code**: 복잡한 비즈니스 로직은 컴포넌트 내부가 아닌 `lib/` 또는 커스텀 훅으로 분리합니다.

## Validation
- 모든 스타일 수정 후에는 실제 화면에서의 시각적 균형과 애니메이션 동작을 철저히 검증해야 합니다.
