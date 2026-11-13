package pe.s7ex.sscudo

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Revisor de enlaces. Si la persona elige SScuDo como app para abrir enlaces,
 * cada toque en un enlace pasa por aquí: se mira la dirección (sin abrirla) y,
 * si no hay señales, se entrega de inmediato al navegador de siempre. Solo se
 * muestra una pantalla cuando el enlace tiene marcas de estafa.
 *
 * Enlaces acortados (bit.ly y similares): se le pregunta al acortador a dónde
 * redirige, sin descargar la página de destino, y se revisa ese destino. Es la
 * misma petición que haría el navegador al tocar el enlace. Si el destino está
 * limpio, se abre el destino ya revisado (no el acortador otra vez).
 *
 * No corre en segundo plano: existe solo durante el toque.
 */
class LinkActivity : Activity() {

    companion object {
        private const val ESPERA_MS = 2500L
        private const val MAX_SALTOS = 5
        private val CONOCIDOS = listOf(
            "com.android.chrome", "org.mozilla.firefox", "com.brave.browser", "com.microsoft.emmx",
            "com.sec.android.app.sbrowser", "com.opera.browser", "com.duckduckgo.mobile.android",
            "com.vivaldi.browser", "com.mi.globalbrowser", "com.huawei.browser",
        )

        // Colores del diseño ("el sello del trámite"); los mismos que src/styles.css.
        private const val PAPEL = 0xFFEDF0F3.toInt()
        private const val HOJA = 0xFFFBFCFD.toInt()
        private const val TINTA = 0xFF1D2A44.toInt()
        private const val TINTA_2 = 0xFF3E4A63.toInt()
        private const val GRIS = 0xFF626D84.toInt()
        private const val LINEA = 0xFFCDD4DE.toInt()
        private const val ROJO = 0xFFC41E3A.toInt()
        private const val OCRE = 0xFF9A5F0C.toInt()
        private const val NEUTRO = 0xFF4A5A78.toInt()

        /** El navegador al que se le pasa el enlace: uno conocido si está instalado, o el primero que haya. */
        fun navegador(ctx: Context): String? {
            val prueba = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com")).addCategory(Intent.CATEGORY_BROWSABLE)
            val candidatos = ctx.packageManager.queryIntentActivities(prueba, PackageManager.MATCH_ALL)
                .map { it.activityInfo.packageName }
                .filter { it != ctx.packageName }
                .distinct()
            return CONOCIDOS.firstOrNull { it in candidatos } ?: candidatos.firstOrNull()
        }

        /**
         * Pregunta al acortador a dónde lleva. No sigue la redirección ni lee el
         * cuerpo: solo la cabecera Location. Devuelve null si no responde con una.
         */
        fun desacortar(url: String): String? {
            val segura = if (url.startsWith("http://", ignoreCase = true)) "https://" + url.substring(7) else url
            for (metodo in listOf("HEAD", "GET")) {
                var c: HttpURLConnection? = null
                try {
                    c = URL(segura).openConnection() as HttpURLConnection
                    c.instanceFollowRedirects = false
                    c.requestMethod = metodo
                    c.connectTimeout = 4000
                    c.readTimeout = 4000
                    c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) SScuDo")
                    val codigo = c.responseCode
                    val destino = c.getHeaderField("Location")
                    if (codigo in 300..399 && !destino.isNullOrBlank()) return URL(URL(segura), destino).toString()
                    if (codigo !in listOf(400, 403, 405, 501)) return null
                } catch (e: Exception) {
                    if (metodo == "GET") return null
                } finally {
                    c?.disconnect()
                }
            }
            return null
        }
    }

    private val principal = Handler(Looper.getMainLooper())
    private var turno = 0
    private var original = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent?.dataString
        if (url.isNullOrBlank()) {
            finish()
            return
        }
        original = url
        revisar(url, listOf(url))
    }

    /** Revisa una dirección con el motor; si es un acortador, sigue un salto más. */
    private fun revisar(url: String, cadena: List<String>) {
        val miTurno = ++turno
        // Si el motor tarda o falla, el enlace se abre igual: SScuDo no debe dejarte sin navegar.
        // Excepción: un acortador nunca se abre sin revisar su destino.
        val porTiempo = Runnable {
            if (miTurno == turno && !isFinishing) {
                turno++
                if (cadena.size > 1) mostrarAviso(url, null, cadena, sinDestino = false) else abrir(url)
            }
        }
        principal.postDelayed(porTiempo, ESPERA_MS)

        Motor.pagina(this, url) { informe ->
            principal.removeCallbacks(porTiempo)
            if (miTurno != turno || isFinishing) return@pagina
            val nivel = informe?.optString("nivel").orEmpty()
            when {
                informe?.optBoolean("acortado") == true -> seguirAcortador(url, cadena)
                informe != null && (nivel == "alto" || nivel == "sospechoso") -> mostrarAviso(url, informe, cadena, sinDestino = false)
                else -> abrir(url)
            }
        }
    }

    private fun seguirAcortador(url: String, cadena: List<String>) {
        if (cadena.size > MAX_SALTOS) {
            mostrarAviso(url, null, cadena, sinDestino = true)
            return
        }
        val miTurno = ++turno
        mostrarEsperando()
        Thread {
            val siguiente = desacortar(url)
            principal.post {
                if (miTurno != turno || isFinishing) return@post
                if (siguiente == null || !(siguiente.startsWith("http://") || siguiente.startsWith("https://"))) {
                    mostrarAviso(url, null, cadena, sinDestino = true)
                } else {
                    revisar(siguiente, cadena + siguiente)
                }
            }
        }.start()
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

    /** Abre la página en el navegador aislado de SScuDo, que la analiza sin dejar tocarla. */
    private fun revisarPagina(url: String) {
        startActivity(Intent(this, PaginaActivity::class.java).putExtra(PaginaActivity.EXTRA_URL, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        finish()
    }

    // ───────── Pantallas

    private fun dp(valor: Int): Int = (valor * resources.displayMetrics.density).toInt()

    private fun texto(contenido: String, tamano: Float, color: Int, negrita: Boolean = false, abajo: Int = 12, mono: Boolean = false): TextView {
        return TextView(this).apply {
            text = contenido
            textSize = tamano
            setTextColor(color)
            typeface = when {
                mono -> Typeface.create(Typeface.MONOSPACE, if (negrita) Typeface.BOLD else Typeface.NORMAL)
                negrita -> Typeface.create("sans-serif", Typeface.BOLD)
                else -> Typeface.create("sans-serif", Typeface.NORMAL)
            }
            setLineSpacing(0f, 1.18f)
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(abajo) }
        }
    }

    private fun pantalla(caja: LinearLayout) {
        val desplazable = ScrollView(this).apply {
            setBackgroundColor(PAPEL)
            isFillViewport = true
            addView(caja, MATCH_PARENT, WRAP_CONTENT)
        }
        window.statusBarColor = PAPEL
        window.navigationBarColor = PAPEL
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        setContentView(desplazable)
    }

    private fun mostrarEsperando() {
        val caja = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(32), dp(32), dp(32))
        }
        caja.addView(ProgressBar(this).apply { isIndeterminate = true }, LinearLayout.LayoutParams(dp(40), dp(40)).apply { bottomMargin = dp(18) })
        caja.addView(texto("Es un enlace acortado", 22f, TINTA, negrita = true, abajo = 6).apply { gravity = Gravity.CENTER })
        caja.addView(texto("SScuDo está averiguando a dónde lleva, sin abrir la página.", 16f, TINTA_2, abajo = 0).apply { gravity = Gravity.CENTER })
        pantalla(caja)
    }

    /** El veredicto como sello de tinta, igual que en la app. */
    private fun sello(etiqueta: String, color: Int): View {
        val fondo = GradientDrawable().apply {
            setColor(HOJA)
            setStroke(dp(3), color)
            cornerRadius = dp(5).toFloat()
        }
        val caja = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            background = fondo
            setPadding(dp(16), dp(8), dp(16), dp(10))
            rotation = -3f
        }
        caja.addView(TextView(this).apply {
            text = "SScuDo revisó"
            textSize = 12f
            setTextColor(color)
            typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
            gravity = Gravity.CENTER
        })
        caja.addView(TextView(this).apply {
            text = etiqueta.uppercase()
            textSize = 28f
            setTextColor(color)
            typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
            gravity = Gravity.CENTER
            setLineSpacing(0f, 0.9f)
        })
        return LinearLayout(this).apply {
            gravity = Gravity.START
            setPadding(dp(4), dp(8), 0, dp(22))
            addView(caja, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
        }
    }

    private fun boton(etiqueta: String, principal: Boolean, accion: () -> Unit): Button {
        return Button(this).apply {
            text = etiqueta
            textSize = 17f
            isAllCaps = false
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
            stateListAnimator = null
            background = GradientDrawable().apply {
                cornerRadius = dp(10).toFloat()
                if (principal) setColor(TINTA) else setStroke(dp(2), TINTA)
            }
            setTextColor(if (principal) HOJA else TINTA)
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, dp(54)).apply { bottomMargin = dp(10) }
            setOnClickListener { accion() }
        }
    }

    private fun dominioDe(url: String): String = try {
        Uri.parse(url).host ?: url
    } catch (e: Exception) {
        url
    }

    private fun mostrarAviso(url: String, informe: JSONObject?, cadena: List<String>, sinDestino: Boolean) {
        turno++
        val alto = informe?.optString("nivel") == "alto"
        val color = when {
            informe == null -> NEUTRO
            alto -> ROJO
            else -> OCRE
        }
        val caja = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(40), dp(22), dp(28))
        }

        if (sinDestino) {
            caja.addView(sello("Destino oculto", NEUTRO))
            caja.addView(texto("No pude ver a dónde lleva", 26f, TINTA, negrita = true, abajo = 8))
            caja.addView(texto("Es un enlace acortado y el acortador no dijo a qué página redirige. Así se esconden muchas páginas de estafa.", 17f, TINTA_2, abajo = 20))
        } else if (informe == null) {
            caja.addView(sello("Sin revisar", NEUTRO))
            caja.addView(texto("El enlace acortado lleva aquí", 26f, TINTA, negrita = true, abajo = 8))
            caja.addView(texto("SScuDo no alcanzó a revisar el destino. Míralo antes de abrirlo.", 17f, TINTA_2, abajo = 20))
        } else {
            caja.addView(sello(if (alto) "Alta probabilidad de estafa" else "Sospechoso", color))
            caja.addView(texto(informe.optString("titulo", "Enlace sospechoso"), 26f, TINTA, negrita = true, abajo = 8))
            caja.addView(texto(informe.optString("detalle"), 17f, TINTA_2, abajo = 20))
        }

        val dominio = informe?.optString("dominio")?.takeIf { it.isNotEmpty() } ?: dominioDe(url)
        caja.addView(texto("Dominio real", 14f, GRIS, abajo = 2))
        caja.addView(texto(dominio, 22f, TINTA, negrita = true, mono = true, abajo = 18))

        if (cadena.size > 1) {
            caja.addView(texto("Por dónde pasa el enlace", 14f, GRIS, abajo = 4))
            caja.addView(texto(cadena.joinToString("\n↓\n") { dominioDe(it) }, 15f, TINTA_2, mono = true, abajo = 18))
        }

        val motivos = informe?.optJSONArray("motivos")
        if (motivos != null && motivos.length() > 0) {
            val lista = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(14), 0, 0, 0)
                background = GradientDrawable().apply { setColor(PAPEL) }
            }
            for (i in 0 until motivos.length()) {
                lista.addView(texto("•  " + motivos.optString(i), 16f, TINTA, abajo = 8))
            }
            caja.addView(lista)
        }

        caja.addView(texto(url.take(200), 13f, GRIS, mono = true, abajo = 24).apply {
            setPadding(0, dp(12), 0, 0)
        })
        caja.addView(View(this).apply { setBackgroundColor(LINEA) }, LinearLayout.LayoutParams(MATCH_PARENT, dp(1)).apply { bottomMargin = dp(18) })

        caja.addView(boton("No abrir", true) { finish() })
        caja.addView(boton("Revisar la página", false) { revisarPagina(if (sinDestino) original else url) })
        caja.addView(Button(this).apply {
            text = "Abrir de todos modos"
            textSize = 15f
            isAllCaps = false
            setTextColor(GRIS)
            setBackgroundColor(0x00000000)
            stateListAnimator = null
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, dp(48))
            setOnClickListener { abrir(url) }
        })
        pantalla(caja)
    }
}
