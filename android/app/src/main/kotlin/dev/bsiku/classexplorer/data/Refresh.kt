package dev.bsiku.classexplorer.data

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.bsiku.classexplorer.widget.updateWidgets
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * 위젯에 채울 값을 받아 오는 배경 작업.
 *
 * ⚠️ **주기는 15분이 바닥입니다** — 안드로이드가 `PeriodicWorkRequest` 에 걸어 둔
 * 하한이고, 더 짧게 적어도 15분으로 올려 버립니다. 교시는 50분마다 바뀌니 최악의
 * 경우 위젯이 15분쯤 늦게 따라옵니다.
 *
 * 정확히 종 칠 때 맞추려면 `AlarmManager.setExactAndAllowWhileIdle` 을 교시 경계마다
 * 걸어야 하는데, 그건 `SCHEDULE_EXACT_ALARM` 권한을 사용자에게 따로 받아야 하고
 * 도즈 모드에서 배터리 경고가 붙습니다. **위젯이 15분 늦는 것과 권한 창을 띄우는 것
 * 중에는 전자가 낫습니다** — 위젯을 여는 이유는 "지금 어디 가야 하지" 지 초 단위
 * 정확도가 아닙니다.
 */
class RefreshWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val token = Store.token(applicationContext) ?: return@withContext Result.success()

        try {
            val home = Api.home(token)
            val menu = home.meal?.let { pointer ->
                // 급식만 따로 받습니다 — 학교 API 가 3~5초씩 걸려서 홈 응답에 안 실려 옵니다.
                // 여기서 실패해도 시간표는 살려야 하므로 통째로 감쌉니다
                runCatching { Api.meal(token, pointer.date).menu }.getOrNull()
            }
            Store.saveSnapshot(applicationContext, home.toSnapshot(menu))
            updateWidgets(applicationContext)
            Result.success()
        } catch (expired: Api.AuthExpired) {
            // 만료됐거나 다른 기기에 밀려났습니다. 계속 두드려 봐야 소용없으니
            // 지우고 멈춥니다 — 위젯이 "다시 로그인하세요" 를 띄웁니다
            Store.clear(applicationContext)
            updateWidgets(applicationContext)
            Result.success()
        } catch (error: Exception) {
            // 네트워크가 잠깐 없는 것뿐일 수 있습니다. 위젯은 **직전 값을 그대로**
            // 들고 있습니다 — 비우면 지하철에서 위젯이 통째로 빕니다
            Result.retry()
        }
    }

    companion object {
        private const val NAME = "class-explorer-refresh"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .build()

            // KEEP 이라 이미 걸려 있으면 그대로 둡니다 — 앱을 열 때마다 다시 걸면
            // 주기가 계속 처음부터 시작해서 영영 안 돕니다
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(NAME)
        }
    }
}

/**
 * 홈 응답 → 위젯이 그릴 한 덩어리.
 *
 * **파생값을 여기서 한 번만 셉니다.** 위젯마다 "지금 몇 교시" 를 따로 계산하면 두
 * 위젯이 다른 말을 하게 됩니다 (웹의 `lib/homeView.ts` 와 같은 이유입니다).
 */
fun Home.toSnapshot(menu: Menu?): Snapshot {
    val offLabel = if (session.hasClass) null else (session.offLabel ?: "수업 없음")
    val byPeriod = periods.associateBy { it.period }

    val label = when {
        offLabel != null -> null
        now.period != null -> "${now.period}교시"
        else -> now.breakName ?: "쉬는시간"
    }

    return Snapshot(
        fetchedAt = System.currentTimeMillis(),
        periodLabel = label,
        offLabel = offLabel,
        current = current?.let { Snapshot.Line(it.period, it.subject, it.room) },
        next = next?.let {
            Snapshot.Line(it.period, it.subject, it.room, byPeriod[it.period]?.start ?: "")
        },
        mealSlot = meal?.slot,
        mealItems = menu?.forSlot(meal?.slot).orEmpty(),
    )
}
