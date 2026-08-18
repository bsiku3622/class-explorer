package dev.bsiku.classexplorer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.bsiku.classexplorer.data.Api
import dev.bsiku.classexplorer.data.RefreshWorker
import dev.bsiku.classexplorer.data.Store
import dev.bsiku.classexplorer.data.toSnapshot
import dev.bsiku.classexplorer.widget.pinWidget
import dev.bsiku.classexplorer.widget.updateWidgets
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Cream = Color(0xFFFFF5D1)
private val Ink = Color(0xFF000000)
private val Pink = Color(0xFFFF4EBA)

/**
 * 앱 화면은 **로그인과 상태 확인**뿐입니다.
 *
 * 시간표를 다시 그리지 않는 이유는 웹이 이미 잘 하고 있어서입니다 — 이 앱이 존재하는
 * 이유는 **위젯**이고, 위젯이 돌려면 토큰과 배경 갱신이 필요합니다. 그 둘을 세우는
 * 게 이 화면이 하는 일 전부입니다.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { Screen() }
    }
}

@Composable
private fun Screen() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()

    var token by remember { mutableStateOf(Store.token(context)) }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var status by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Cream)
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            "CLASS EXPLORER",
            fontSize = 26.sp,
            fontWeight = FontWeight.Black,
            color = Ink,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            if (token == null) "학교 계정으로 로그인하세요" else "위젯을 홈 화면에 추가하세요",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = Ink.copy(alpha = 0.45f),
        )
        Spacer(Modifier.height(28.dp))

        if (token == null) {
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("아이디") },
                singleLine = true,
                shape = RectangleShape,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("비밀번호") },
                singleLine = true,
                shape = RectangleShape,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(16.dp))

            RetroButton(
                label = if (busy) "로그인 중…" else "로그인",
                enabled = !busy && username.isNotBlank() && password.isNotBlank(),
            ) {
                busy = true
                status = null
                scope.launch {
                    val result = runCatching {
                        withContext(Dispatchers.IO) {
                            val fresh = Api.login(username.trim(), password)
                            Store.saveToken(context, fresh)
                            // 로그인 직후 한 번 받아 둡니다 — 안 그러면 위젯이 최대
                            // 15분 동안 "아직 받아온 게 없습니다" 를 띄웁니다
                            val home = Api.home(fresh)
                            val menu = home.meal?.let {
                                runCatching { Api.meal(fresh, it.date).menu }.getOrNull()
                            }
                            Store.saveSnapshot(context, home.toSnapshot(menu))
                            fresh
                        }
                    }
                    busy = false
                    result
                        .onSuccess {
                            token = it
                            password = ""
                            RefreshWorker.schedule(context)
                            updateWidgets(context)
                        }
                        .onFailure {
                            status = if (it is Api.AuthExpired || it.message?.contains("401") == true) {
                                "아이디나 비밀번호가 틀렸습니다."
                            } else {
                                "연결하지 못했습니다. 잠시 후 다시 시도하세요."
                            }
                        }
                }
            }
        } else {
            Text(
                "한 계정으로 기기 5대까지 쓸 수 있습니다. 웹에서 로그인해도 이 폰은 그대로 " +
                    "유지되고, 목록과 해제는 웹의 About 화면에 있습니다.",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = Ink.copy(alpha = 0.5f),
            )
            Spacer(Modifier.height(16.dp))
            RetroButton(label = if (busy) "새로고침 중…" else "지금 새로고침", enabled = !busy) {
                busy = true
                scope.launch {
                    val result = runCatching {
                        withContext(Dispatchers.IO) {
                            val home = Api.home(token!!)
                            val menu = home.meal?.let {
                                runCatching { Api.meal(token!!, it.date).menu }.getOrNull()
                            }
                            Store.saveSnapshot(context, home.toSnapshot(menu))
                        }
                    }
                    busy = false
                    result
                        .onSuccess {
                            updateWidgets(context)
                            status = "위젯을 새로 그렸습니다."
                        }
                        .onFailure {
                            if (it is Api.AuthExpired) {
                                // 만료됐거나 **다른 기기에 밀려났습니다**
                                Store.clear(context)
                                RefreshWorker.cancel(context)
                                token = null
                                status = "세션이 끊겼습니다. 다시 로그인하세요."
                                updateWidgets(context)
                            } else {
                                status = "새로고침하지 못했습니다."
                            }
                        }
                }
            }
            Spacer(Modifier.height(10.dp))
            // 위젯을 홈에 놓는 길을 앱이 직접 냅니다 — 런처 목록에서 찾아 끌어다
            // 놓게 두면, 정작 이 앱의 전부인 기능을 못 찾는 사람이 생깁니다
            RetroButton(label = "지금 위젯 추가", enabled = !busy, filled = false) {
                scope.launch {
                    if (!pinWidget(context, now = true)) {
                        status = "런처가 자동 추가를 지원하지 않습니다. 홈 화면을 길게 눌러 추가하세요."
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            RetroButton(label = "급식 위젯 추가", enabled = !busy, filled = false) {
                scope.launch {
                    if (!pinWidget(context, now = false)) {
                        status = "런처가 자동 추가를 지원하지 않습니다. 홈 화면을 길게 눌러 추가하세요."
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            RetroButton(label = "로그아웃", enabled = !busy, filled = false) {
                scope.launch {
                    // 서버에도 알려서 세션 목록에서 사라지게 합니다. 실패해도 폰에서는
                    // 지웁니다 — 여기서 막히면 로그아웃을 영영 못 합니다
                    runCatching { withContext(Dispatchers.IO) { Api.logout(token!!) } }
                    Store.clear(context)
                    RefreshWorker.cancel(context)
                    token = null
                    status = null
                    updateWidgets(context)
                }
            }
        }

        status?.let {
            Spacer(Modifier.height(14.dp))
            Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Ink.copy(alpha = 0.6f))
        }
    }
}


/** 웹의 `RetroButton` 을 옮긴 것 — 굵은 검정 테두리, 직각, 채우는 건 주 동작 하나 */
@Composable
private fun RetroButton(
    label: String,
    enabled: Boolean = true,
    filled: Boolean = true,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RectangleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (filled) Pink else Color.White,
            contentColor = Ink,
            disabledContainerColor = Color.White,
            disabledContentColor = Ink.copy(alpha = 0.3f),
        ),
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
            .border(2.dp, Ink, RectangleShape),
    ) {
        Text(label, fontWeight = FontWeight.Black, fontSize = 14.sp)
    }
}
