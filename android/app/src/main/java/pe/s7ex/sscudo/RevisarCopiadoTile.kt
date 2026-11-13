package pe.s7ex.sscudo

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * Botón "Revisar copiado" en los ajustes rápidos (la cortina de notificaciones).
 * WhatsApp y Mensajes no dejan compartir el texto de un mensaje, pero sí copiarlo:
 * se copia, se baja la cortina y se toca este botón. Abre SScuDo, que lee lo
 * copiado cuando ya tiene el foco (Android no deja leerlo antes).
 */
class RevisarCopiadoTile : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            state = Tile.STATE_INACTIVE
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        val abrir = Intent(this, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_PORTAPAPELES, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        if (Build.VERSION.SDK_INT >= 34) {
            val pendiente = PendingIntent.getActivity(this, 7, abrir, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            startActivityAndCollapse(pendiente)
        } else {
            @Suppress("DEPRECATION", "StartActivityAndCollapseDeprecated")
            startActivityAndCollapse(abrir)
        }
    }
}
