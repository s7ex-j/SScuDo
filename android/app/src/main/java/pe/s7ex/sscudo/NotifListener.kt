package pe.s7ex.sscudo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

/**
 * Lee el texto de las notificaciones que llegan (WhatsApp, SMS, correo) y lo
 * pasa por el motor. Solo avisa cuando el nivel es "alto". No guarda ni envía
 * nada: el texto vive en memoria lo que dura el análisis.
 *
 * Android solo lo activa si la persona lo permite en Ajustes → Acceso a notificaciones.
 */
class NotifListener : NotificationListenerService() {

    private val vistos = LinkedHashSet<Int>()

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null || sbn.packageName == packageName || sbn.isOngoing) return
        val aviso = sbn.notification ?: return
        if (aviso.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val extras = aviso.extras ?: return
        val texto = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))
            ?.toString()?.trim().orEmpty()
        if (texto.length < 25) return

        // La misma notificación se actualiza varias veces: cada texto se revisa una sola vez.
        val huella = texto.hashCode()
        if (!vistos.add(huella)) return
        if (vistos.size > 80) vistos.remove(vistos.first())

        val origen = sbn.packageName
        Motor.mensaje(applicationContext, texto) { informe ->
            if (informe != null && informe.optString("nivel") == "alto") alertar(origen, texto, informe, huella)
        }
    }

    private fun nombreDe(paquete: String): String? {
        return try {
            val info = packageManager.getApplicationInfo(paquete, 0)
            packageManager.getApplicationLabel(info).toString()
        } catch (e: Exception) {
            null
        }
    }

    private fun alertar(origen: String, texto: String, informe: JSONObject, huella: Int) {
        val gestor = NotificationManagerCompat.from(this)
        if (!gestor.areNotificationsEnabled()) return

        val canal = NotificationChannel("estafas", getString(R.string.canal_nombre), NotificationManager.IMPORTANCE_HIGH)
        canal.description = getString(R.string.canal_descripcion)
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(canal)

        val abrir = Intent(this, MainActivity::class.java)
            .setAction("pe.s7ex.sscudo.VER_$huella")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(MainActivity.EXTRA_TEXTO, texto)
        val alTocar = PendingIntent.getActivity(this, huella, abrir, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val campana = if (informe.isNull("campana")) "" else informe.optString("campana")
        val motivo = informe.optJSONArray("motivos")?.optString(0).orEmpty()
        val cuerpo = when {
            campana.isNotEmpty() -> "Se parece a: $campana. Toca para ver por qué."
            motivo.isNotEmpty() -> "$motivo. Toca para ver por qué."
            else -> "Toca para ver por qué."
        }

        val alerta = NotificationCompat.Builder(this, "estafas")
            .setSmallIcon(R.drawable.ic_escudo)
            .setColor(0xFFC41E3A.toInt())
            .setContentTitle(nombreDe(origen)?.let { "Posible estafa en un mensaje de $it" } ?: "Posible estafa en un mensaje")
            .setContentText(cuerpo)
            .setStyle(NotificationCompat.BigTextStyle().bigText(cuerpo))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(alTocar)
            .build()
        try {
            gestor.notify(huella, alerta)
        } catch (e: SecurityException) {
            // falta el permiso de avisos: la app lo pide desde su pantalla principal
        }
    }
}
