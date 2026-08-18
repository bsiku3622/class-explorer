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
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.ColumnScope
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.Text
import dev.bsiku.classexplorer.MainActivity
import dev.bsiku.classexplorer.data.Snapshot
import dev.bsiku.classexplorer.data.Store

/**
 * **지금** — 어디로 가야 하는가.
 *
 * ```
 * 수업 중                        공강
 * ┌───────────────────────┐     ┌───────────────────────┐
 * │ ███████████████████ │     │ ┌───────────────────┐ │
 * │ █ 3교시            █ │     │ │ 다음 · 11:40      │ │
 * │ █ 선형대수(EC)     █ │ 핑크 │ │ 정보과학3         │ │ 흰색
 * │ █ 형3402           █ │     │ │ 창5702            │ │
 * │ ███████████████████ │     │ └───────────────────┘ │
 * │ 다음 11:40 정보과학3  │     │ 지금은 공강입니다      │
 * └───────────────────────┘     └───────────────────────┘
 * ```
 *
 * **덩어리 하나가 위젯을 이끕니다.** 그 안에 든 건 늘 같은 것 — *지금 알아야 할 수업*
 * 입니다. 수업 중이면 진행 중인 수업이 핑크로 들어가고, 공강이면 다음 수업이 흰
 * 덩어리로 들어갑니다. 색이 곧 "이미 시작했는가" 입니다.
 *
 * 처음엔 교시를 작은 칩으로 얹고 나머지를 글자로만 뒀는데, 아래 절반이 통째로 비고
 * 색이 손톱만큼이라 홈 화면에서 아무 말도 못 했습니다 — 위젯은 스쳐 보는 물건이라
 * **읽을 것이 하나여야** 합니다.
 *
 * ⚠️ **네트워크를 직접 치지 않습니다.** `Store` 에 미리 받아 둔 것만 읽습니다 — 런처가
 * 위젯을 그리는 동안 통신하면 홈 화면이 멈춥니다 (`RefreshWorker` 참고).
 */
class NowWidget : GlanceAppWidget() {

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
                when {
                    token == null -> Notice("로그인이 필요합니다", "눌러서 로그인")
                    snapshot == null -> Notice("아직 받아온 게 없습니다", "눌러서 새로고침")
                    snapshot.offLabel != null -> Notice(snapshot.offLabel, "수업이 없는 날입니다")
                    else -> Body(snapshot)
                }
            }
        }
    }
}

/** 그릴 수업이 없을 때. **덩어리는 그대로 둡니다** — 위젯이 통째로 비면 고장으로 보입니다 */
@Composable
private fun Notice(title: String, hint: String) {
    Column(
        modifier = Retro.BlockPlain.fillMaxSize().padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = Retro.title(17), maxLines = 2)
        Spacer(GlanceModifier.height(3.dp))
        Text(hint, style = Retro.caption())
    }
}

@Composable
private fun ColumnScope.Body(snapshot: Snapshot) {
    // 지금 수업이 있으면 그것이, 없으면 다음 수업이 주인공입니다 —
    // **핑크는 "이미 시작했다" 는 뜻**이라 다음 수업에는 칠하지 않습니다
    val live = snapshot.current
    val hero = live ?: snapshot.next
    val eyebrow = when {
        live != null -> snapshot.periodLabel ?: "${live.period}교시"
        hero != null -> listOf("다음", hero.start).filter { it.isNotEmpty() }.joinToString(" · ")
        else -> "오늘 수업 끝"
    }

    Column(
        modifier = (if (live != null) Retro.BlockNow else Retro.BlockPlain)
            .fillMaxWidth()
            .defaultWeight()
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(eyebrow, style = Retro.caption(12, Retro.Ink))
        Spacer(GlanceModifier.height(4.dp))
        if (hero == null) {
            Text("수고했습니다", style = Retro.title())
        } else {
            Text(hero.subject, style = Retro.title(), maxLines = 2)
            Spacer(GlanceModifier.height(1.dp))
            Text(hero.room, style = Retro.body(15))
        }
    }

    // 덩어리 아래 한 줄 — 덩어리가 "지금" 이면 다음을, "다음" 이면 지금 상태를 답니다.
    // 둘 다 없으면(오늘 끝) 아무 말도 안 붙입니다
    val footer = when {
        live != null && snapshot.next != null -> snapshot.next.let {
            listOf("다음", it.start, it.subject, it.room).filter { part -> part.isNotEmpty() }
                .joinToString(" · ")
        }
        live != null -> "오늘 마지막 수업입니다"
        hero != null -> "지금은 공강입니다"
        else -> null
    }
    if (footer != null) {
        Spacer(GlanceModifier.height(7.dp))
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            Text(footer, style = Retro.caption(), maxLines = 1)
        }
    }
}

class NowWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NowWidget()
}
