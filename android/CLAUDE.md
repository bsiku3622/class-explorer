# Android Guide

> [← 프로젝트 전체 가이드](../CLAUDE.md)

**이 앱이 존재하는 이유는 위젯입니다.** 시간표를 다시 그리지 않습니다 — 웹이 이미 잘
하고 있고, 폰에서 웹으로 안 되는 건 **홈 화면에 얹히는 것** 하나뿐입니다.

| | |
|---|---|
| 언어·도구 | Kotlin + Jetpack **Glance** (위젯) + Compose (앱 화면) |
| 최소 / 목표 | minSdk 26 · targetSdk 35 |
| 패키지 | `dev.bsiku.classexplorer` |
| 서버 | **웹과 같은 백엔드**(`classesapi.bsiku.dev`). 앱 전용 API 는 없습니다 |

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21   # JDK 가 PATH 에 없습니다 (homebrew keg-only)
./gradlew :app:assembleDebug     # APK → app/build/outputs/apk/debug/
./gradlew :app:lintDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`local.properties`(SDK 경로)는 git 에 안 올라갑니다 — 새로 받으면 만들어야 합니다.

---

## 다중 기기 로그인이 **전제조건**이었습니다

앱은 웹과 다른 기기에서 로그인합니다. 예전 백엔드는 **1계정 1세션**이라 앱에서
로그인하는 순간 브라우저가 튕겼습니다 — 그래서 앱보다 인증을 먼저 고쳤습니다
(`backend/CLAUDE.md` 의 "다중 기기 로그인").

- 로그인은 `POST /auth/login` + `device_type: "mobile"`
- ⚠️ **User-Agent 를 바꾸지 마세요**(`BuildConfig.USER_AGENT`). 서버가 여기서 기기
  이름을 뽑아 "로그인한 기기" 목록에 답니다. 지우면 폰이 그냥 `모바일` 로만 뜹니다
- 로그아웃은 **이 기기만** 끊습니다 — 폰에서 로그아웃했다고 노트북까지 튕기면 안 됩니다
- 401 은 만료일 수도, **다른 기기에 밀려난 것**(계정당 5대)일 수도 있습니다. 처리는
  같습니다 — 토큰을 지우고 위젯에 "로그인이 필요합니다" 를 띄웁니다

---

## 구조

```
data/Api.kt       → OkHttp + kotlinx.serialization. /auth/login · /home · /meal · /auth/logout
data/Store.kt     → SharedPreferences: 토큰 + **위젯이 그릴 한 조각**(Snapshot)
data/Refresh.kt   → WorkManager 주기 갱신 + Home → Snapshot 변환
widget/Common.kt  → 색·글자 스타일, updateWidgets(), pinWidget()
widget/NowWidget  → 지금(또는 다음) 수업 한 덩어리
widget/MealWidget → 지금 끼니의 메뉴
MainActivity.kt   → 로그인 · 새로고침 · 위젯 추가 · 로그아웃. **이게 전부입니다**
```

### ⚠️ 위젯은 네트워크를 직접 치지 않습니다

`RefreshWorker` 가 미리 받아 `Store` 에 넣어 두고, **위젯은 그것만 읽고 그립니다.**
런처가 위젯을 그리는 순간에 통신하면 홈 화면이 그동안 멈춥니다.

**`Snapshot` 하나를 두 위젯이 같이 씁니다.** 위젯마다 따로 받으면 같은 `/home` 을 두 번
치고, 무엇보다 두 위젯이 서로 다른 시각을 말하게 됩니다 (웹의 `lib/homeView.ts` 와 같은
이유입니다).

### ⚠️ 갱신 주기는 15분이 바닥입니다

안드로이드가 `PeriodicWorkRequest` 에 걸어 둔 하한이라 더 짧게 적어도 올라갑니다. 교시는
50분마다 바뀌니 최악의 경우 위젯이 15분쯤 늦습니다.

종 칠 때 정확히 맞추려면 `AlarmManager.setExactAndAllowWhileIdle` 을 교시 경계마다 걸어야
하는데, `SCHEDULE_EXACT_ALARM` 권한을 따로 받아야 하고 도즈에서 배터리 경고가 붙습니다.
**위젯이 15분 늦는 것과 권한 창을 띄우는 것 중에는 전자가 낫습니다** — 위젯을 여는 이유는
"지금 어디 가야 하지" 지 초 단위 정확도가 아닙니다.

네트워크가 없으면 `Result.retry()` 로 두고 **직전 값을 그대로 둡니다** — 비우면
지하철에서 위젯이 통째로 빕니다.

---

## 디자인

웹의 레트로 브루탈리즘을 옮겼습니다 — 크림(`#FFF5D1`) 바탕, 2dp 순수 검정 테두리.

**색 덩어리 하나가 위젯을 이끕니다.** 처음엔 교시를 작은 핑크 칩으로 얹고 나머지를
글자로만 뒀는데, **아래 절반이 통째로 비고 색이 손톱만큼이라** 홈 화면에서 아무 말도 못
했습니다. 위젯은 스쳐 보는 물건이라 **읽을 것이 하나여야** 합니다.

| 위젯 | 덩어리 | 뜻 |
|---|---|---|
| 지금 | 핑크 `#FF4EBA` | **진행 중인 수업.** 공강이면 흰 덩어리에 다음 수업 |
| 급식 | 끼니색 (아침 노랑·점심 주황·저녁 보라) | 지금 끼니 |

⚠️ **급식에 핑크를 쓰지 마세요.** 핑크는 "지금" 이고 그건 옆 위젯이 쓰는 뜻입니다.
저녁 보라 위에는 글자가 흰색입니다(`Retro.mealInk`).

### ⚠️ Glance 에는 `border` modifier 가 없습니다

위젯은 RemoteViews 로 그려지고 RemoteViews 는 테두리를 모릅니다. **배경 자체를 선이
그려진 그림으로 깝니다** — `GlanceModifier.background(ImageProvider(R.drawable.…))`.

### ⚠️ Android 12+ 런처는 위젯을 둥글게 잘라냅니다

직각으로 그리면 잘리는 게 모서리만이 아니라 **테두리 선 자체**입니다 — 실제로 윗변만
남고 좌·우·아랫변이 통째로 사라졌습니다. 막을 방법이 없어서 맞췄습니다:
`@dimen/widget_corner` 가 API 30 이하에서는 `0dp`(원래 모습), v31 이상에서는
`@android:dimen/system_app_widget_background_radius` 입니다.

**안쪽 덩어리는 직각 그대로**입니다 — 사방에서 물러나 있어 마스크에 안 닿습니다.

### 미리보기 레이아웃은 **두 벌**입니다

런처의 위젯 목록에는 Glance 가 아직 안 그려졌으므로 `@layout/widget_preview_*` 를
보여 줍니다. 없으면 큰 흰 상자에 앱 아이콘만 뜹니다. ⚠️ **위젯을 고치면 여기도 같이
고쳐야** 목록에서 본 것과 놓고 본 것이 같습니다.

### ⚠️ 급식 위젯 기본 크기를 3×2 로 줄이지 마세요

3×3 이 절반쯤 비어 보여서 줄여 봤는데, 여섯 줄짜리 메뉴에서 **마지막 줄이 글자 중간에서
잘렸습니다.** 스크롤은 되지만 잘린 줄은 고장으로 읽힙니다 — 꼬리에 남는 빈 자리는 목록
위젯이면 다 그렇고, 여덟 줄인 날에는 꽉 찹니다.

---

## 앱 화면

로그인 · 새로고침 · **위젯 추가** · 로그아웃뿐입니다.

"위젯 추가" 는 `requestPinGlanceAppWidget` 입니다. 이게 없으면 사용자는 홈을 길게 눌러
→ 위젯 → 목록에서 앱을 찾아 → 끌어다 놓아야 합니다. **이 앱의 전부인 기능인데** 그 길을
앱이 안 알려 주면 이상합니다. 런처가 거절하면 `false` 를 돌려주므로 안내 문구로 받습니다.

⚠️ 토큰은 평범한 `SharedPreferences`(앱 전용 저장소)에 둡니다.
`EncryptedSharedPreferences` 를 쓸까 했지만 그 라이브러리가 alpha 라 빌드가 흔들립니다.
루팅 안 된 기기에서는 다른 앱이 못 읽고, 새더라도 웹 `/about` 에서 그 기기를 끊을 수
있습니다.

---

## 검증

**테스트 파일은 만들지 않습니다** (프로젝트 규칙). 대신 에뮬레이터에 올려서 봅니다.

```bash
emulator -avd Medium_Phone_API_36.1 &
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

로그인 없이 위젯 그림만 확인하려면 `Store` 를 직접 심습니다 — 위젯은 그것만 읽습니다.

```bash
adb push prefs.xml /data/local/tmp/prefs.xml
adb shell "run-as dev.bsiku.classexplorer mkdir -p shared_prefs;
           run-as dev.bsiku.classexplorer cp /data/local/tmp/prefs.xml shared_prefs/class_explorer.xml"
```

`prefs.xml` 은 `<map>` 안에 `session_token` 과 `snapshot`(Snapshot JSON) 두 개면 됩니다.
⚠️ 앱을 한 번은 실행해야 `shared_prefs` 디렉토리가 생깁니다.

**위젯을 홈에 올릴 때 드래그를 흉내 내지 마세요** — `input swipe` 로는 런처가 안 집어
듭니다. 앱의 "위젯 추가" 버튼을 누르고 시스템 확인 창의 `Add to home screen` 을 탭하는
쪽이 확실합니다.
