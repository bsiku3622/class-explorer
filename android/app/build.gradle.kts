plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "dev.bsiku.classexplorer"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.bsiku.classexplorer"
        // Glance 위젯이 요구하는 최소치는 21 이지만, 위젯의 둥근 모서리·크기 조정이
        // 제대로 도는 건 31 부터입니다. 학교 학생들 폰은 그보다 새것입니다
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // ⚠️ 이 값이 서버의 세션 목록에 그대로 뜹니다 — 백엔드가 User-Agent 에서
        // 기기 이름을 뽑기 때문입니다(`_device_label`). 바꾸면 "로그인한 기기" 화면에서
        // 폰이 뭔지 못 알아봅니다
        buildConfigField("String", "USER_AGENT", "\"ClassExplorer-Android/$versionName\"")
        buildConfigField("String", "API_BASE", "\"https://classesapi.bsiku.dev\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            // 로컬 백엔드를 볼 때 쓰는 값. 에뮬레이터에서 10.0.2.2 가 호스트의
            // localhost 입니다 — `127.0.0.1` 로 두면 에뮬레이터 자신을 가리킵니다
            buildConfigField("String", "API_BASE", "\"https://classesapi.bsiku.dev\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    sourceSets["main"].java.srcDirs("src/main/kotlin")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)

    implementation(libs.androidx.glance.appwidget)
    implementation(libs.androidx.glance.material3)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.datastore.preferences)

    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
}
