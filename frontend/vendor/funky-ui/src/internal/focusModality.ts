/**
 * 포커스 링은 Tab 으로 왔을 때만 보입니다.
 *
 * `:focus-visible` 만으로는 모자랍니다 — 글자 칸은 마우스로 눌러도 브라우저가 늘 `:focus-visible` 로 칩니다. 그래서 마지막 입력이
 * Tab 인지를 `<html data-fk-focus>` 에 적고, `styles/global.css.ts` 가 `pointer` 일 때 링 두께를 0 으로 둡니다.
 * 이 모듈이 돌지 않는 페이지(CSS 만 가져다 쓴 곳)는 브라우저의 `:focus-visible` 판단으로 돌아갑니다.
 *
 * ⚠️ import 만으로 도는 모듈이라 package.json 의 `sideEffects` 에 이 파일과 이것을 부르는 `src/index.ts` 가 **둘 다** 있어야 번들에
 * 남습니다. 진입 파일이 빠지면 번들러가 배럴을 건너뛰면서 이 import 도 같이 버립니다 — dev 서버에서는 멀쩡하고 배포본에서만 링이 돌아옵니다.
 */
if (typeof document !== "undefined") {
  const root = document.documentElement;
  root.dataset.fkFocus = "pointer";
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Tab") root.dataset.fkFocus = "tab";
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    () => {
      root.dataset.fkFocus = "pointer";
    },
    true,
  );
}

export {};
