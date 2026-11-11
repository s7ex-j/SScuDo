plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// La firma llega por variables de entorno (las pone el flujo de GitHub a partir
// de los secretos). Sin ellas, el APK sale con la firma de depuración: sirve
// para probar, pero cada versión nueva obliga a desinstalar la anterior.
val almacen: String? = System.getenv("ANDROID_KEYSTORE")

android {
    namespace = "pe.s7ex.sscudo"
    compileSdk = 34

    defaultConfig {
        applicationId = "pe.s7ex.sscudo"
        minSdk = 26
        targetSdk = 34
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("VERSION_NAME") ?: "0.2.0"
    }

    signingConfigs {
        if (almacen != null) {
            create("publicacion") {
                storeFile = file(almacen)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName(if (almacen != null) "publicacion" else "debug")
        }
    }

    lint {
        checkReleaseBuilds = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.webkit:webkit:1.11.0")
}
