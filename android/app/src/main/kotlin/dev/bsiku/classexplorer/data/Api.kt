package dev.bsiku.classexplorer.data

import dev.bsiku.classexplorer.BuildConfig
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * 백엔드 호출.
 *
 * 웹과 **같은 서버·같은 세션 체계**를 씁니다 — 이 앱을 위해 새로 만든 API 는 없습니다.
 * 다중 기기 로그인이 먼저 열려 있어야 하는 이유가 이것입니다(그 전에는 앱에서
 * 로그인하는 순간 브라우저가 튕겼습니다).
 *
 * ⚠️ **User-Agent 를 바꾸지 마세요.** 서버가 여기서 기기 이름을 뽑아
 * "로그인한 기기" 목록에 답니다. 지우면 목록에서 폰이 그냥 `모바일` 로만 뜹니다.
 */
object Api {
    private val client = OkHttpClient.Builder()
        // 위젯 갱신은 배경에서 돕니다 — 오래 매달려 있으면 배터리만 먹고,
        // 어차피 다음 주기에 다시 시도합니다
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true // 서버가 필드를 더해도 앱이 안 죽게
        coerceInputValues = true
    }

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    class AuthExpired : IOException("세션이 만료되었습니다")

    private inline fun <reified T> call(path: String, token: String?, body: String? = null): T {
        val request = Request.Builder()
            .url("${BuildConfig.API_BASE}$path")
            .header("User-Agent", BuildConfig.USER_AGENT)
            .apply {
                if (token != null) header("Authorization", "Bearer $token")
                if (body != null) post(body.toRequestBody(jsonMedia))
            }
            .build()

        client.newCall(request).execute().use { response ->
            // 401 은 만료일 수도, **다른 기기에 밀려난 것**일 수도 있습니다 (계정당 5대).
            // 부르는 쪽은 둘을 구별할 필요가 없습니다 — 어느 쪽이든 다시 로그인입니다
            if (response.code == 401) throw AuthExpired()
            if (!response.isSuccessful) throw IOException("HTTP ${response.code}")
            return json.decodeFromString(response.body!!.string())
        }
    }

    fun login(username: String, password: String): String {
        val body = json.encodeToString(
            LoginRequest.serializer(),
            LoginRequest(username, password),
        )
        return call<LoginResponse>("/auth/login", token = null, body = body).sessionToken
    }

    fun home(token: String): Home = call("/home", token)

    fun meal(token: String, date: String): MealResponse = call("/meal?date=$date", token)

    /**
     * **이 기기만** 로그아웃합니다 — 웹 세션은 그대로 남습니다.
     *
     * 폰에서 로그아웃했다고 책상 위 노트북까지 튕기면 안 됩니다. 서버가 요청에 실린
     * 토큰의 세션 하나만 지웁니다.
     */
    fun logout(token: String) {
        call<Detail>("/auth/logout", token, body = "{}")
    }
}

@Serializable
private data class LoginRequest(
    val username: String,
    val password: String,
    /** 서버가 세션 목록에서 웹과 가려 보여 줍니다 */
    @SerialName("device_type") val deviceType: String = "mobile",
)

@Serializable
private data class LoginResponse(@SerialName("session_token") val sessionToken: String)

/** 내용이 필요 없는 응답(`{"detail": "..."}`) — 성공 여부는 HTTP 상태가 말합니다 */
@Serializable
private data class Detail(val detail: String = "")

// ─── 홈 응답 ─────────────────────────────────────────────────────────────────
//
// 웹의 `GET /home` 을 그대로 받습니다. 위젯에 필요한 것만 골라 두었고, 나머지 필드는
// `ignoreUnknownKeys` 가 흘려보냅니다.

@Serializable
data class Home(
    val now: Now,
    val session: SessionState,
    val today: List<Klass> = emptyList(),
    val current: Klass? = null,
    val next: Klass? = null,
    val periods: List<PeriodTime> = emptyList(),
    val meal: MealPointer? = null,
)

@Serializable
data class Now(
    val time: String,
    /** 자정 기준 분 — **서버 시계**입니다. 폰 시계가 틀어져 있어도 여기가 기준 */
    val minute: Int,
    val date: String,
    val day: String? = null,
    val period: Int? = null,
    @SerialName("break_name") val breakName: String? = null,
)

@Serializable
data class SessionState(
    /** 오늘 수업이 있는 날인가. false 면 `today` 는 항상 비어 있습니다 */
    @SerialName("has_class") val hasClass: Boolean = true,
    @SerialName("off_reason") val offReason: String? = null,
    /** `"여름방학"`·`"주말"` — 화면에 그대로 씁니다 */
    @SerialName("off_label") val offLabel: String? = null,
)

@Serializable
data class Klass(
    val period: Int,
    val subject: String,
    val section: String = "",
    val teacher: String = "",
    val room: String = "",
)

@Serializable
data class PeriodTime(
    val period: Int,
    val start: String,
    val end: String,
    @SerialName("start_minute") val startMinute: Int,
    @SerialName("end_minute") val endMinute: Int,
)

/** 홈 응답에는 **메뉴가 없습니다** — 학교 API 가 느려서 따로 받습니다 */
@Serializable
data class MealPointer(val date: String, val slot: String? = null)

@Serializable
data class MealResponse(val date: String, val menu: Menu? = null)

@Serializable
data class Menu(
    val breakfast: List<String> = emptyList(),
    val lunch: List<String> = emptyList(),
    val dinner: List<String> = emptyList(),
) {
    fun forSlot(slot: String?): List<String> = when (slot) {
        "breakfast" -> breakfast
        "lunch" -> lunch
        "dinner" -> dinner
        else -> emptyList()
    }
}
