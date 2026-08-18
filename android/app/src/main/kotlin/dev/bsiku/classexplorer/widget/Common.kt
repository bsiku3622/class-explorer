package dev.bsiku.classexplorer.widget

import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.text.FontWeight
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import dev.bsiku.classexplorer.R

/**
 * 위젯 둘이 같이 쓰는 생김새.
 *
 * 웹의 레트로 브루탈리즘을 옮겼습니다 — 크림 바탕, 2dp 순수 검정 테두리, 직각 모서리.
 *
 * ## 색 덩어리 하나가 위젯을 이끕니다
 *
 * 처음엔 교시를 작은 핑크 칩으로 얹고 나머지를 글자로만 뒀는데, **아래 절반이 통째로
 * 비고 색이 손톱만큼만 있어서** 홈 화면에서 아무 말도 못 했습니다. 웹에서 "지금" 은
 * 카드 폭을 꽉 채우는 핑크 띠인데 그게 칩 하나로 쪼그라든 셈이었습니다.
 *
 * 지금은 **덩어리 하나가 위젯의 대부분을 차지합니다** — 지금 알아야 할 수업(또는 지금
 * 끼니)이 그 안에 들어가고, 나머지는 아래 한 줄입니다. 위젯은 스쳐 보는 물건이라
 * 읽을 것이 하나여야 합니다.
 *
 * ⚠️ **런처 배경이 무엇인지 알 수 없습니다.** 그래서 시스템 테마(`GlanceTheme`)를 따르지
 * 않고 색을 고정합니다 — 다크 모드에 맞춰 배경을 어둡게 하면 검정 테두리가 사라지고,
 * 이 디자인은 그 선이 전부입니다.
 */
object Retro {
    val Ink = Color(0xFF000000)
    val Paper = Color(0xFFFFFFFF)
    val Muted = Color(0x59000000)

    /** 크림 바탕 + 검정 테두리 — 위젯 바깥 상자 */
    val Frame = GlanceModifier.background(ImageProvider(R.drawable.widget_frame))

    /** 핑크 = **지금 진행 중**. 다른 뜻으로 쓰지 마세요 */
    val BlockNow = GlanceModifier.background(ImageProvider(R.drawable.widget_block_now))

    /** 흰 덩어리 — 아직 시작하지 않은 것(다음 수업) */
    val BlockPlain = GlanceModifier.background(ImageProvider(R.drawable.widget_block_plain))

    /**
     * 끼니색 — 웹의 `MealCard` 와 같습니다 (아침 노랑 · 점심 주황 · 저녁 보라).
     *
     * 급식에 핑크를 쓰지 않는 이유는 **핑크가 "지금" 이기 때문**입니다. 한 화면에서
     * 같은 색이 두 뜻을 가지면 안 됩니다.
     */
    fun mealBlock(slot: String?): GlanceModifier = GlanceModifier.background(
        ImageProvider(
            when (slot) {
                "breakfast" -> R.drawable.widget_block_breakfast
                "dinner" -> R.drawable.widget_block_dinner
                else -> R.drawable.widget_block_lunch
            },
        ),
    )

    /** 저녁 보라 위에 검은 글자를 올리면 안 읽힙니다 — 웹의 `readableInk` 와 같은 판단 */
    fun mealInk(slot: String?): Color = if (slot == "dinner") Paper else Ink

    fun title(size: Int = 19, color: Color = Ink) =
        TextStyle(color = ColorProvider(color), fontSize = size.sp, fontWeight = FontWeight.Bold)

    fun body(size: Int = 14, color: Color = Ink) =
        TextStyle(color = ColorProvider(color), fontSize = size.sp, fontWeight = FontWeight.Medium)

    fun caption(size: Int = 11, color: Color = Muted) =
        TextStyle(color = ColorProvider(color), fontSize = size.sp, fontWeight = FontWeight.Bold)
}

/**
 * 두 위젯을 한꺼번에 다시 그립니다.
 *
 * 새 값을 받은 쪽(`RefreshWorker`)이 부릅니다 — **위젯이 스스로 받아 오지 않습니다.**
 * 런처가 위젯을 그리는 순간에 네트워크를 치면 홈 화면이 그동안 멈춥니다.
 */
suspend fun updateWidgets(context: Context) {
    NowWidget().updateAll(context)
    MealWidget().updateAll(context)
}

/**
 * 홈 화면에 위젯을 놓아 달라고 시스템에 부탁합니다 — **런처가 확인 창을 띄웁니다.**
 *
 * 이게 없으면 사용자는 홈을 길게 눌러 → 위젯 → 목록에서 앱을 찾아 → 끌어다 놓아야
 * 합니다. **이 앱이 존재하는 이유가 위젯인데** 그 길을 앱이 안 알려 주면 이상합니다.
 *
 * ⚠️ 모든 런처가 받아 주지는 않습니다. 거절하면 `false` 를 돌려주므로, 부르는 쪽이
 * "직접 추가하세요" 로 안내해야 합니다.
 */
suspend fun pinWidget(context: Context, now: Boolean): Boolean = runCatching {
    GlanceAppWidgetManager(context).requestPinGlanceAppWidget(
        if (now) NowWidgetReceiver::class.java else MealWidgetReceiver::class.java,
    )
}.getOrDefault(false)
