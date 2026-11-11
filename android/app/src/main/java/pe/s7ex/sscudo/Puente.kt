package pe.s7ex.sscudo

import android.Manifest
import android.app.Activity
import android.app.role.RoleManager
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

/** Lo que la interfaz web puede pedirle a Android. Se expone como `SScuDoAndroid`. */
class Puente(private val actividad: Activity) {

    @JavascriptInterface
    fun estado(): String {
        val ctx = actividad.applicationContext
        val notificaciones = NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName)
        val enlaces = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roles = ctx.getSystemService(RoleManager::class.java)
            roles != null && roles.isRoleHeld(RoleManager.ROLE_BROWSER)
        } else {
            false
        }
        val avisos = NotificationManagerCompat.from(ctx).areNotificationsEnabled()
        return JSONObject()
            .put("notificaciones", notificaciones)
            .put("enlaces", enlaces)
            .put("avisos", avisos)
            .toString()
    }

    @JavascriptInterface
    fun abrirAccesoNotificaciones() {
        actividad.runOnUiThread {
            try {
                actividad.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            } catch (e: Exception) {
                actividad.startActivity(Intent(Settings.ACTION_SETTINGS))
            }
        }
    }

    @JavascriptInterface
    fun pedirRevisorDeEnlaces() {
        actividad.runOnUiThread {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val roles = actividad.getSystemService(RoleManager::class.java)
                    if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_BROWSER) && !roles.isRoleHeld(RoleManager.ROLE_BROWSER)) {
                        actividad.startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_BROWSER), 41)
                        return@runOnUiThread
                    }
                }
                actividad.startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
            } catch (e: Exception) {
                actividad.startActivity(Intent(Settings.ACTION_SETTINGS))
            }
        }
    }

    @JavascriptInterface
    fun pedirPermisoAvisos() {
        actividad.runOnUiThread {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                actividad.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 42)
            } else {
                val ajustes = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, actividad.packageName)
                actividad.startActivity(ajustes)
            }
        }
    }
}
