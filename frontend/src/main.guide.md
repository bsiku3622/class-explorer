# main.tsx Guide

> [← Frontend Guide](../CLAUDE.md)

## 역할
React 앱의 진입점. 전역 Provider 설정 + 렌더링.

## 구성
```tsx
<React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
</React.StrictMode>
```

## Provider 역할
| Provider | 패키지 | 역할 |
|----------|--------|------|
| `BrowserRouter` | `react-router-dom` | URL 기반 라우팅 활성화 |

## 주의
- HeroUI 를 걷어내면서 `HeroUIProvider` 가 빠졌습니다 (2026-08-21). 남은 것은
  `StrictMode` 와 `BrowserRouter` 뿐입니다.
- `StrictMode`는 개발 환경에서만 이중 렌더링으로 사이드이펙트를 감지합니다.
