package dev.bsiku.classexplorer.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.Text
import dev.bsiku.classexplorer.MainActivity
import dev.bsiku.classexplorer.data.Store

/**
 * **급식** — 지금 끼니의 메뉴.
 *
 * ```
 * ┌────────────────────┐
 * │ ██████████████████ │  ← 끼니색 머리 (점심=주황)
 * │ █ 점심           █ │
 * │ ██████████████████ │
 * │ 흑미밥              │
 * │ 쇠고기미역국        │
 * │ 제육볶음            │
 * │ 계란찜              │
 * │ 배추김치            │
 * └────────────────────┘
 * ```
 *
 * ⚠️ **핑크를 쓰지 않습니다.** 핑크는 "지금" 이고 그건 옆 위젯이 쓰는 뜻입니다. 끼니는
 * 웹의 `MealCard` 와 같은 색을 씁니다 — 아침 노랑 · 점심 주황 · 저녁 보라.
 *
 * **세 끼를 늘어놓지 않습니다.** 한 끼가 예닐곱 줄이라 셋을 펼치면 위젯이 화면 절반을
 * 먹습니다 — 지금 시간대의 끼니만 보여 주고, 다른 끼니는 앱에서 봅니다.
 *
 * 목록은 `LazyColumn` 입니다. 위젯 크기를 사용자가 줄일 수 있어서, 고정 높이로 두면
 * 작은 위젯에서 메뉴 아래쪽이 그냥 잘려 나갑니다 — 스크롤되면 최소한 볼 수는 있습니다.
 */
class MealWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val token = Store.token(context)
        val snapshot = Store.snapshot(context)

        provideContent {
            Column(
                modifier = Retro.Frame
                    .fillMaxSize()
                    .padding(10.dp)
                    .clickable(actionStartActivity<MainActivity>()),
            ) {
                if (token == null || snapshot == null) {
                    Column(
                        modifier = Retro.BlockPlain.fillMaxSize().padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            if (token == null) "로그인이 필요합니다" else "아직 받아온 게 없습니다",
                            style = Retro.title(17),
                            maxLines = 2,
                        )
                        Spacer(GlanceModifier.height(3.dp))
                        Text("눌러서 앱 열기", style = Retro.caption())
                    }
                    return@Column
                }

                // 끼니 머리 — 이 위젯에서 색을 가진 유일한 면입니다
                Row(
                    modifier = Retro.mealBlock(snapshot.mealSlot)
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        snapshot.mealTitle,
                        style = Retro.title(17, Retro.mealInk(snapshot.mealSlot)),
                    )
                }
                Spacer(GlanceModifier.height(8.dp))

                if (snapshot.mealItems.isEmpty()) {
                    // 급식이 없는 날일 수도, 학교 API 가 아직 안 올린 것일 수도 있습니다.
                    // 둘을 구별할 방법이 없으니 한 문장으로 덮습니다
                    Text("등록된 메뉴가 없습니다", style = Retro.caption())
                } else {
                    Menu(snapshot.mealItems)
                }
            }
        }
    }
}

@Composable
private fun Menu(items: List<String>) {
    LazyColumn(modifier = GlanceModifier.fillMaxSize()) {
        items(items) { item ->
            Text(
                item,
                style = Retro.body(14),
                maxLines = 1,
                modifier = GlanceModifier.padding(vertical = 3.dp),
            )
        }
    }
}

class MealWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MealWidget()
}
