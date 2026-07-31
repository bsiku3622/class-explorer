# BarChartRow Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
수평/수직 바 차트 행. AnalysisPage의 통계 시각화에 사용.

## Props
| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `label` | `string` | 필수 | 항목 이름 |
| `value` | `number` | 필수 | 현재 값 |
| `maxValue` | `number` | 필수 | 최대 값 (바 길이 계산용) |
| `caption` | `string` | - | 바 옆 보조 텍스트 |
| `layout` | `"horizontal" \| "vertical"` | `"horizontal"` | 레이아웃 방향 |
| `captionClassName` | `string` | - | 캡션 추가 클래스 |
| `onLabelClick` | `() => void` | - | 라벨 클릭 핸들러 |

## 레이아웃
```
horizontal:
  [라벨]  [████████████░░░░░░]  [caption]

vertical:
  [라벨]
  [████████████░░░░░░]
  [caption]
```

## 바 스타일
```
높이:   h-5 고정
색상:   bg-retro-primary (#ff3e3e)
호버:   group-hover:bg-[#ff7e7e] (연핑크)
비율:   width = (value / maxValue) * 100%
```

## 라벨 클릭
`onLabelClick`이 있으면 라벨이 클릭 가능한 링크처럼 동작 → 검색 트리거.

## 사용 예시
```tsx
// AnalysisPage 과목 통계
<BarChartRow
  label={getKoreanName(subject.name)}
  value={subject.studentCount}
  maxValue={maxStudents}
  caption={`${subject.studentCount} Students`}
  onLabelClick={() => handleSearch(getKoreanName(subject.name))}
/>

// 교사 통계 (캡션 색상 강조)
<BarChartRow
  label={`${teacher.name} T.`}
  value={teacher.periods}
  maxValue={maxPeriods}
  caption={`${teacher.periods} PDS | ${teacher.sections} Sections`}
  captionClassName="text-retro-primary"
  onLabelClick={() => handleSearch(teacher.name, true)}
/>
```
