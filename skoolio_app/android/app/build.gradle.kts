plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "app.skoolio"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        resValues = true
    }

    defaultConfig {
        // Overridden per-flavor below
        applicationId = "app.skoolio"
        minSdk = flutter.minSdkVersion
        targetSdk = 35
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // ── Two-app flavor split ──────────────────────────────────────────────────
    // Build student APK:  flutter build apk --flavor student -t lib/main_student.dart
    // Build teacher APK:  flutter build apk --flavor teacher -t lib/main_teacher.dart
    flavorDimensions += "portal"

    productFlavors {
        create("student") {
            dimension          = "portal"
            applicationId      = "app.skoolio.student"
            resValue("string", "app_name", "Skoolio Student")
            // Student-specific icon set lives in src/student/res/
        }
        create("teacher") {
            dimension          = "portal"
            applicationId      = "app.skoolio.teacher"
            resValue("string", "app_name", "Skoolio Teacher")
            // Teacher-specific icon set lives in src/teacher/res/
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
