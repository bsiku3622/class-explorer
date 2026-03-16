# main.tsx Guide

> [← Frontend Guide](../CLAUDE.md)

## 역할
React 앱의 진입점. 전역 Provider 설정 + 렌더링.

## 구성
```tsx
<React.StrictMode>
  <HeroUIProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </HeroUIProvider>
</React.StrictMode>
```

## Provider 역할
| Provider | 패키지 | 역할 |
|----------|--------|------|
| `HeroUIProvider` | `@heroui/react` | HeroUI 컴포넌트 컨텍스트 |
| `BrowserRouter` | `react-router-dom` | URL 기반 라우팅 활성화 |

## 주의
- `HeroUIProvider`가 `BrowserRouter` 밖에 위치해야 합니다.
- `StrictMode`는 개발 환경에서만 이중 렌더링으로 사이드이펙트를 감지합니다.
