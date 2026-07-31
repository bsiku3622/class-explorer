# AccordionSection Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
아이콘 + 제목이 있는 토글 가능한 섹션 패널.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `title` | `string` | 섹션 제목 |
| `icon` | `LucideIcon` | 헤더 아이콘 |
| `isOpen` | `boolean` | 현재 펼침 상태 (외부 관리) |
| `onToggle` | `() => void` | 토글 핸들러 |
| `children` | `ReactNode` | 펼쳐질 내용 |

## 동작
- 헤더 클릭 → `onToggle()` 호출
- `isOpen=true`: 컨텐츠 페이드인 (`opacity-0 → opacity-100`)
- 상태는 **외부**에서 관리 (AnalysisPage의 `openSections`)

## 헤더 스타일
```
flex items-center justify-between cursor-pointer
border-b-2 border-black pb-4 mb-4
제목: text-lg font-black uppercase
아이콘: 우측에 ChevronDown (펼침) / ChevronUp (접힘)
```

## 사용 예시
```tsx
// AnalysisPage에서
const [openSections, setOpenSections] = useState({
  compare: false, subjects: false
});

<AccordionSection
  title="Students Analysis"
  icon={Users}
  isOpen={openSections.subjects}
  onToggle={() => setOpenSections(prev => ({
    ...prev, subjects: !prev.subjects
  }))}
>
  {/* 바 차트 목록 */}
</AccordionSection>
```
