# BarChartRow Guide

> [← Component Guide](../../../../../frontend/component-guide.md)

## 역할
funky-ui `Meter` 에 이 앱의 핑크와 대문자 이름을 얹은 막대 한 줄. AnalysisPage 의 통계와 Admin 의 전공 조사에 씁니다.

## Props
| prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `label` | `string` | 필수 | 항목 이름 |
| `value` | `number` | 필수 | 현재 값 |
| `maxValue` | `number` | 필수 | 최대 값 (바 길이 계산용) |
| `caption` | `string` | - | 바 옆 보조 텍스트 |
| `layout` | `"horizontal" \| "vertical"` | `"vertical"` | `horizontal` 은 넓은 화면에서 한 줄(`Meter layout="row"`), `vertical` 은 쌓기 |
| `onLabelClick` | `() => void` | - | 라벨 클릭 핸들러 |
| `tooltipContent` | `ReactNode` | - | 막대에 올렸을 때 위에 뜨는 판 (`Meter tooltip`) |

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
높이·홈·채움:  Meter 가 정합니다 (accent="pink")
비율:          width = (value / maxValue) * 100%, maxValue 는 0 이어도 1 로 받습니다
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

// 교사 통계
<BarChartRow
  label={`${teacher.name} T.`}
  value={teacher.periods}
  maxValue={maxPeriods}
  caption={`${teacher.periods} PDS | ${teacher.sections} Sections`}
  onLabelClick={() => handleSearch(teacher.name, true)}
/>
```
