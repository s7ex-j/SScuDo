package pe.s7ex.sscudo

import android.Manifest
import android.app.Activity
import android.app.role.RoleManager
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Lo que la interfaz web puede pedirle a Android. Se expone como `SScuDoAndroid`. */
class Puente(private val actividad: Activity) {

    companion object {
        /** Lee el texto copiado. Solo funciona con la app en primer plano y con foco. */
        fun leerPortapapeles(ctx: Context): String {
            val portapapeles = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return ""
            val clip = portapapeles.primaryClip ?: return ""
            if (clip.itemCount == 0) return ""
            return clip.getItemAt(0).coerceToText(ctx)?.toString()?.trim().orEmpty()
        }

        /** ¿Hay texto copiado? Mira solo la descripción: no lee el contenido. */
        fun hayTextoCopiado(ctx: Context): Boolean {
            val portapapeles = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
            val d = portapapeles.primaryClipDescription ?: return false
            return d.hasMimeType(ClipDescription.MIMETYPE_TEXT_PLAIN) || d.hasMimeType(ClipDescription.MIMETYPE_TEXT_HTML)
        }
    }

    /** El portapapeles se toca en el hilo principal; la interfaz web llama desde otro. */
    private fun <T> enPrincipal(defecto: T, f: () -> T): T {
        var r = defecto
        val listo = CountDownLatch(1)
        actividad.runOnUiThread {
            try {
                r = f()
            } catch (e: Exception) {
                r = defecto
            } finally {
                listo.countDown()
            }
        }
        listo.await(1, TimeUnit.SECONDS)
        return r
    }

    /** La revisión de página que dejó PaginaActivity (se entrega una sola vez). */
    @JavascriptInterface
    fun tomarRevision(): String {
        val r = PaginaActivity.resultado.orEmpty()
        PaginaActivity.resultado = null
        return r
    }

    /** Abre la página en el navegador aislado de SScuDo para revisarla. */
    @JavascriptInterface
    fun revisarPagina(url: String) {
        if (!(url.startsWith("http://") || url.startsWith("https://"))) return
        actividad.runOnUiThread {
            actividad.startActivity(android.content.Intent(actividad, PaginaActivity::class.java).putExtra(PaginaActivity.EXTRA_URL, url.take(2000)))
        }
    }

    @JavascriptInterface
    fun hayCopiado(): Boolean = enPrincipal(false) { hayTextoCopiado(actividad) }

    @JavascriptInterface
    fun leerCopiado(): String = enPrincipal("") { leerPortapapeles(actividad).take(6000) }

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
