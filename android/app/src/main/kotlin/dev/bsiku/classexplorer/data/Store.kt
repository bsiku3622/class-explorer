package dev.bsiku.classexplorer.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * 토큰과 **위젯이 그릴 한 조각**을 보관합니다.
 *
 * 위젯은 앱이 꺼져 있어도 그려집니다. 그릴 때마다 네트워크를 치면 런처가 멈추고
 * 배터리를 먹으므로, `RefreshWorker` 가 미리 받아 둔 것을 여기서 꺼내 씁니다 —
 * **위젯은 이 파일만 읽고 그립니다.**
 */
object Store {
    private const val PREFS = "class_explorer"
    private const val KEY_TOKEN = "session_token"
    private const val KEY_SNAPSHOT = "snapshot"

    private val json = Json { ignoreUnknownKeys = true }

    // ⚠️ 평범한 SharedPreferences 입니다(앱 전용 저장소). `EncryptedSharedPreferences`
    // 를 쓸까 했지만 그 라이브러리가 alpha 라 빌드가 흔들립니다. 루팅 안 된 기기에서는
    // 다른 앱이 못 읽고, 토큰이 새더라도 `/about` 에서 그 기기를 끊을 수 있습니다
    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun token(context: Context): String? = prefs(context).getString(KEY_TOKEN, null)

    fun saveToken(context: Context, token: String) {
        prefs(context).edit().putString(KEY_TOKEN, token).apply()
    }

    /** 로그아웃·세션 만료 — 토큰과 함께 **화면에 남은 내용도 지웁니다** */
    fun clear(context: Context) {
        prefs(context).edit().remove(KEY_TOKEN).remove(KEY_SNAPSHOT).apply()
    }

    fun snapshot(context: Context): Snapshot? =
        prefs(context).getString(KEY_SNAPSHOT, null)?.let {
            runCatching { json.decodeFromString<Snapshot>(it) }.getOrNull()
        }

    fun saveSnapshot(context: Context, snapshot: Snapshot) {
        prefs(context)
            .edit()
            .putString(KEY_SNAPSHOT, json.encodeToString(Snapshot.serializer(), snapshot))
            .apply()
    }
}

/**
 * 위젯 두 개가 같이 읽는 한 덩어리.
 *
 * **한 번 받아서 둘 다 채웁니다.** 위젯마다 따로 받으면 같은 `/home` 을 두 번 치고,
 * 무엇보다 두 위젯이 서로 다른 시각을 말하게 됩니다.
 */
@Serializable
data class Snapshot(
    /** 받은 시각(epoch ms) — 위젯이 "몇 분 전 정보인지" 를 말할 수 있게 */
    val fetchedAt: Long,
    /** `"3교시"` · `"점심"` · `null`(수업 없는 날) */
    val periodLabel: String? = null,
    /** 지금 있어야 할 수업. 없으면 공강입니다 */
    val current: Line? = null,
    /** 다음 수업. 없으면 오늘 수업이 끝났습니다 */
    val next: Line? = null,
    /** `"여름방학"`·`"주말"` — 있으면 수업 관련 값은 전부 비어 있습니다 */
    val offLabel: String? = null,
    val mealSlot: String? = null,
    val mealItems: List<String> = emptyList(),
) {
    @Serializable
    data class Line(
        val period: Int,
        val subject: String,
        val room: String,
        /** `"11:40"` — 다음 수업 줄에서만 씁니다 */
        val start: String = "",
    )

    val mealTitle: String
        get() = when (mealSlot) {
            "breakfast" -> "아침"
            "lunch" -> "점심"
            "dinner" -> "저녁"
            else -> "급식"
        }
}
