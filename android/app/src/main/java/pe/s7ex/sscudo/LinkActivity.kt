package pe.s7ex.sscudo

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject

/**
 * Revisor de enlaces. Si la persona elige SScuDo como app para abrir enlaces,
 * cada toque en un enlace pasa por aquí: se mira la dirección (sin abrirla) y,
 * si no hay señales, se entrega de inmediato al navegador de siempre. Solo se
 * muestra una pantalla cuando el enlace tiene marcas de estafa.
 *
 * No corre en segundo plano: existe solo durante el toque.
 */
class LinkActivity : Activity() {

    companion object {
        private const val ESPERA_MS = 1500L
        private val CONOCIDOS = listOf(
            "com.android.chrome", "org.mozilla.firefox", "com.brave.browser", "com.microsoft.emmx",
            "com.sec.android.app.sbrowser", "com.opera.browser", "com.duckduckgo.mobile.android",
            "com.vivaldi.browser", "com.mi.globalbrowser", "com.huawei.browser",
        )

        /** El navegador al que se le pasa el enlace: uno conocido si está instalado, o el primero que haya. */
        fun navegador(ctx: Context): String? {
            val prueba = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com")).addCategory(Intent.CATEGORY_BROWSABLE)
            val candidatos = ctx.packageManager.queryIntentActivities(prueba, PackageManager.MATCH_ALL)
                .map { it.activityInfo.packageName }
                .filter { it != ctx.packageName }
                .distinct()
            return CONOCIDOS.firstOrNull { it in candidatos } ?: candidatos.firstOrNull()
        }
    }

    private val principal = Handler(Looper.getMainLooper())
    private var resuelto = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent?.dataString
        if (url.isNullOrBlank()) {
            finish()
            return
        }

        // Si el motor tarda o falla, el enlace se abre igual: SScuDo no debe dejarte sin navegar.
        val porTiempo = Runnable { decidir(url, null) }
        principal.postDelayed(porTiempo, ESPERA_MS)

        Motor.pagina(this, url) { informe ->
            principal.removeCallbacks(porTiempo)
            decidir(url, informe)
        }
    }

    private fun decidir(url: String, informe: JSONObject?) {
        if (resuelto || isFinishing) return
        resuelto = true
        val nivel = informe?.optString("nivel").orEmpty()
        if (informe != null && (nivel == "alto" || nivel == "sospechoso")) {
            mostrarAviso(url, informe, nivel == "alto")
        } else {
            abrir(url)
        }
    }

    private fun abrir(url: String) {
        val destino = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val paquete = navegador(this)
        if (paquete == null) {
            Toast.makeText(this, "SScuDo no encontró un navegador para abrir el enlace.", Toast.LENGTH_LONG).show()
        } else {
            try {
                startActivity(destino.setPackage(paquete))
            } catch (e: Exception) {
                Toast.makeText(this, "No se pudo abrir el enlace.", Toast.LENGTH_LONG).show()
            }
        }
        finish()
    }

    private fun dp(valor: Int): Int = (valor * resources.displayMetrics.density).toInt()

    private fun mostrarAviso(url: String, informe: JSONObject, alto: Boolean) {
        val tono = if (alto) 0xFFFF5C7A.toInt() else 0xFFFFD84D.toInt()
        val claro = 0xFFF1EADD.toInt()
        val gris = 0xFFC0B9AD.toInt()

        val caja = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF151923.toInt())
            setPadding(dp(24), dp(56), dp(24), dp(28))
        }

        fun texto(contenido: String, tamano: Float, color: Int, negrita: Boolean = false, abajo: Int = 12): TextView {
            return TextView(this).apply {
                text = contenido
                textSize = tamano
                setTextColor(color)
                if (negrita) setTypeface(typeface, Typeface.BOLD)
                setLineSpacing(0f, 1.15f)
                layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(abajo) }
            }
        }

        caja.addView(texto("SScuDo detuvo este enlace", 14f, gris, abajo = 6))
        caja.addView(texto(informe.optString("titulo", "Enlace sospechoso"), 28f, tono, negrita = true))
        caja.addView(texto(informe.optString("detalle"), 17f, claro, abajo = 18))

        val dominio = informe.optString("dominio")
        if (dominio.isNotEmpty()) {
            caja.addView(texto("Dominio real", 13f, gris, abajo = 2))
            caja.addView(texto(dominio, 20f, claro, negrita = true, abajo = 18).apply { typeface = Typeface.MONOSPACE })
        }

        val motivos = informe.optJSONArray("motivos")
        if (motivos != null) {
            for (i in 0 until motivos.length()) {
                caja.addView(texto("•  " + motivos.optString(i), 16f, gris, abajo = 6))
            }
        }

        caja.addView(texto(url.take(160), 13f, 0xFF8F8A97.toInt(), abajo = 26).apply {
            typeface = Typeface.MONOSPACE
            setPadding(0, dp(14), 0, 0)
        })

        val cerrar = Button(this).apply {
            text = "No abrir"
            textSize = 17f
            isAllCaps = false
            setTextColor(0xFF1B1408.toInt())
            setBackgroundColor(0xFFE0B27A.toInt())
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, dp(54)).apply { bottomMargin = dp(10) }
            setOnClickListener { finish() }
        }
        val seguir = Button(this).apply {
            text = "Abrir de todos modos"
            textSize = 15f
            isAllCaps = false
            setTextColor(gris)
            setBackgroundColor(0x00000000)
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, dp(48))
            setOnClickListener { abrir(url) }
        }
        caja.addView(cerrar)
        caja.addView(seguir)

        val desplazable = ScrollView(this).apply {
            setBackgroundColor(0xFF151923.toInt())
            isFillViewport = true
            addView(caja, MATCH_PARENT, WRAP_CONTENT)
        }
        setContentView(desplazable)
    }
}
