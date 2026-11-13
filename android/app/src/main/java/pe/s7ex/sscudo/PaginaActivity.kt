package pe.s7ex.sscudo

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.PixelCopy
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.SafeBrowsingResponse
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Revisa una página abriéndola en un navegador aislado dentro de la app, a
 * pedido de la persona. Se ve en pantalla pero no se puede tocar: nada de lo
 * que hay en ella recibe toques ni teclado.
 *
 * Qué se guarda de la página: la dirección final, por dónde pasó, su código
 * (hasta 600 KB), su texto visible, una captura y el aviso de Google Safe
 * Browsing si lo hay. Eso pasa a la interfaz (MainActivity), que lo analiza con
 * el motor de SScuDo en el teléfono. No se envía a ningún servidor.
 *
 * Lo que sí ocurre, y la pantalla lo dice: la página ve la conexión del
 * teléfono, como al abrirla en cualquier navegador.
 *
 * Aislamiento: sin cookies, sin acceso a archivos, sin puente con la app, sin
 * ventanas nuevas, sin permisos (cámara, ubicación), sin diálogos, sin
 * descargas, y solo navega a direcciones http/https.
 */
class PaginaActivity : Activity() {

    companion object {
        const val EXTRA_URL = "pe.s7ex.sscudo.URL"
        private const val MAX_HTML = 600_000
        private const val ESPERA_RENDER_MS = 2500L
        private const val LIMITE_MS = 20_000L

        /** Resultado listo para que la interfaz lo tome (una sola vez). */
        @Volatile
        var resultado: String? = null

        private val SEGUNDO_NIVEL = setOf("com.pe", "gob.pe", "org.pe", "edu.pe", "net.pe", "mil.pe", "nom.pe", "com.ar", "com.mx", "com.co", "com.br", "co.uk")

        /** Aproximación al dominio registrado, solo para consultar su fecha. */
        fun registrable(host: String): String {
            val partes = host.lowercase().trimEnd('.').split(".")
            if (partes.size <= 2) return partes.joinToString(".")
            val ultimos2 = partes.takeLast(2).joinToString(".")
            return if (ultimos2 in SEGUNDO_NIVEL) partes.takeLast(3).joinToString(".") else ultimos2
        }

        /** Fecha de registro del dominio por RDAP (el sucesor público de WHOIS). */
        fun fechaRegistro(dominio: String): String? {
            var c: HttpURLConnection? = null
            return try {
                c = URL("https://rdap.org/domain/" + Uri.encode(dominio)).openConnection() as HttpURLConnection
                c.connectTimeout = 4000
                c.readTimeout = 4000
                c.setRequestProperty("Accept", "application/rdap+json")
                if (c.responseCode != 200) return null
                val cuerpo = c.inputStream.bufferedReader().use { it.readText() }
                val eventos = JSONObject(cuerpo).optJSONArray("events") ?: return null
                for (i in 0 until eventos.length()) {
                    val e = eventos.optJSONObject(i) ?: continue
                    if (e.optString("eventAction") == "registration") return e.optString("eventDate").ifEmpty { null }
                }
                null
            } catch (e: Exception) {
                null
            } finally {
                c?.disconnect()
            }
        }

        private const val PAPEL = 0xFFEDF0F3.toInt()
        private const val HOJA = 0xFFFBFCFD.toInt()
        private const val TINTA = 0xFF1D2A44.toInt()
        private const val TINTA_2 = 0xFF3E4A63.toInt()
        private const val GRIS = 0xFF626D84.toInt()
    }

    private val principal = Handler(Looper.getMainLooper())
    private lateinit var web: WebView
    private lateinit var estado: TextView
    private var pedida = ""
    private val cadena = mutableListOf<String>()
    private var amenaza: String? = null
    private var terminado = false
    private var extrayendo = false

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pedida = intent?.getStringExtra(EXTRA_URL).orEmpty()
        if (!(pedida.startsWith("http://") || pedida.startsWith("https://"))) {
            finish()
            return
        }
        cadena.add(pedida)

        window.statusBarColor = PAPEL
        window.navigationBarColor = PAPEL
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        val caja = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(PAPEL)
            setPadding(dp(20), dp(28), dp(20), dp(16))
        }
        fun texto(t: String, tam: Float, color: Int, negrita: Boolean = false, mono: Boolean = false) = TextView(this).apply {
            text = t
            textSize = tam
            setTextColor(color)
            typeface = Typeface.create(if (mono) Typeface.MONOSPACE else Typeface.SANS_SERIF, if (negrita) Typeface.BOLD else Typeface.NORMAL)
            setLineSpacing(0f, 1.15f)
        }
        caja.addView(texto("Revisando la página", 24f, TINTA, negrita = true))
        caja.addView(texto(pedida.take(160), 13f, GRIS, mono = true).apply { setPadding(0, dp(4), 0, dp(12)) })

        // La página, a la vista pero sin poder tocarla.
        web = WebView(this)
        val marco = FrameLayout(this).apply {
            background = GradientDrawable().apply {
                setColor(HOJA)
                setStroke(dp(6), TINTA)
                cornerRadius = dp(18).toFloat()
            }
            setPadding(dp(6), dp(6), dp(6), dp(6))
            addView(web, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(View(this@PaginaActivity).apply { setOnTouchListener { _, _ -> true } }, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        }
        caja.addView(marco, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))

        estado = texto("Cargando en un navegador aislado de SScuDo…", 15f, TINTA_2).apply { setPadding(0, dp(12), 0, dp(4)) }
        caja.addView(estado)
        caja.addView(texto("No puede leer tus otras apps ni tus contraseñas, pero la página sí ve tu conexión, como en cualquier navegador.", 13f, GRIS).apply { setPadding(0, 0, 0, dp(10)) })
        caja.addView(Button(this).apply {
            text = "Cancelar"
            isAllCaps = false
            textSize = 16f
            setTextColor(TINTA)
            stateListAnimator = null
            background = GradientDrawable().apply {
                cornerRadius = dp(10).toFloat()
                setStroke(dp(2), TINTA)
            }
            setOnClickListener { cerrar() }
        }, LinearLayout.LayoutParams(MATCH_PARENT, dp(50)))
        setContentView(caja)

        configurar()
        principal.postDelayed({ extraer() }, LIMITE_MS)
        web.loadUrl(pedida)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configurar() {
        val s = web.settings
        s.javaScriptEnabled = true // muchas páginas de estafa se arman con JavaScript
        s.domStorageEnabled = true
        s.allowFileAccess = false
        s.allowContentAccess = false
        s.javaScriptCanOpenWindowsAutomatically = false
        s.setSupportMultipleWindows(false)
        s.setGeolocationEnabled(false)
        s.mediaPlaybackRequiresUserGesture = true
        s.loadWithOverviewMode = true
        s.useWideViewPort = true
        CookieManager.getInstance().setAcceptCookie(false)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        web.setDownloadListener { _, _, _, _, _ -> /* nunca se descarga nada */ }

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url.toString()
                if (!(u.startsWith("http://") || u.startsWith("https://"))) return true // intent:, tel:, whatsapp:… bloqueados
                if (request.isForMainFrame && cadena.lastOrNull() != u && cadena.size < 12) cadena.add(u)
                return false
            }

            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                if (url.startsWith("http") && cadena.lastOrNull() != url && cadena.size < 12) cadena.add(url)
                estado.text = "Cargando " + (Uri.parse(url).host ?: url) + "…"
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (terminado || !url.startsWith("http")) return
                estado.text = "Leyendo el texto y el código de la página…"
                principal.removeCallbacksAndMessages(TOKEN_RENDER)
                principal.postAtTime({ extraer() }, TOKEN_RENDER, android.os.SystemClock.uptimeMillis() + ESPERA_RENDER_MS)
            }

            override fun onSafeBrowsingHit(view: WebView, request: WebResourceRequest, threatType: Int, callback: SafeBrowsingResponse) {
                amenaza = when (threatType) {
                    WebViewClient.SAFE_BROWSING_THREAT_PHISHING -> "PHISHING"
                    WebViewClient.SAFE_BROWSING_THREAT_MALWARE -> "MALWARE"
                    WebViewClient.SAFE_BROWSING_THREAT_UNWANTED_SOFTWARE -> "UNWANTED_SOFTWARE"
                    else -> "OTRA"
                }
                callback.backToSafety(false)
                principal.post { extraer() }
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) = request.deny()
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) = callback.invoke(origin, false, false)
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean { result.cancel(); return true }
            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean { result.cancel(); return true }
            override fun onJsPrompt(view: WebView, url: String, message: String, defaultValue: String?, result: JsPromptResult): Boolean { result.cancel(); return true }
            override fun onJsBeforeUnload(view: WebView, url: String, message: String, result: JsResult): Boolean { result.confirm(); return true }
        }
    }

    private val TOKEN_RENDER = Any()

    /** Saca el código, el texto visible y la captura; luego consulta la fecha del dominio. */
    private fun extraer() {
        if (terminado || extrayendo || isFinishing) return
        extrayendo = true
        principal.removeCallbacksAndMessages(null)
        val js = "(function(){try{return JSON.stringify({url:location.href," +
            "html:document.documentElement?document.documentElement.outerHTML.slice(0,$MAX_HTML):''," +
            "texto:document.body?document.body.innerText.slice(0,20000):''})}catch(e){return null}})()"
        web.evaluateJavascript(js) { crudo ->
            val pagina = try {
                val interior = JSONTokener(crudo).nextValue() as? String
                if (interior != null) JSONObject(interior) else JSONObject()
            } catch (e: Exception) {
                JSONObject()
            }
            capturar { imagen ->
                val final = pagina.optString("url").takeIf { it.startsWith("http") } ?: cadena.last()
                if (cadena.lastOrNull() != final) cadena.add(final)
                estado.text = "Consultando la antigüedad del dominio…"
                Thread {
                    val creado = fechaRegistro(registrable(Uri.parse(final).host.orEmpty()))
                    principal.post { entregar(pagina, final, imagen, creado) }
                }.start()
            }
        }
    }

    /** Copia lo que se ve de la página (PixelCopy funciona con la vista acelerada por hardware). */
    private fun capturar(listo: (String?) -> Unit) {
        val ancho = web.width
        val alto = web.height
        if (ancho <= 0 || alto <= 0 || amenaza != null) return listo(null)
        val pos = IntArray(2)
        web.getLocationInWindow(pos)
        val mapa = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888)
        try {
            PixelCopy.request(window, Rect(pos[0], pos[1], pos[0] + ancho, pos[1] + alto), mapa, { r ->
                if (r != PixelCopy.SUCCESS) return@request listo(null)
                val escala = 390f / ancho
                val chico = Bitmap.createScaledBitmap(mapa, 390, (alto * escala).toInt().coerceAtLeast(1), true)
                val salida = ByteArrayOutputStream()
                chico.compress(Bitmap.CompressFormat.JPEG, 60, salida)
                listo("data:image/jpeg;base64," + Base64.encodeToString(salida.toByteArray(), Base64.NO_WRAP))
            }, principal)
        } catch (e: Exception) {
            listo(null)
        }
    }

    private fun entregar(pagina: JSONObject, final: String, imagen: String?, creado: String?) {
        if (terminado) return
        terminado = true
        val sb = if (Build.VERSION.SDK_INT >= 26 && web.settings.safeBrowsingEnabled) JSONObject().put("amenaza", amenaza ?: JSONObject.NULL) else null
        resultado = JSONObject()
            .put("pedida", pedida)
            .put("final", final)
            .put("cadena", JSONArray(cadena))
            .put("html", pagina.optString("html"))
            .put("texto", pagina.optString("texto"))
            .put("captura", imagen ?: JSONObject.NULL)
            .put("creado", creado ?: JSONObject.NULL)
            .put("safeBrowsing", sb ?: JSONObject.NULL)
            .toString()
        startActivity(Intent(this, MainActivity::class.java).putExtra(MainActivity.EXTRA_REVISION, true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))
        cerrar()
    }

    private fun cerrar() {
        terminado = true
        principal.removeCallbacksAndMessages(null)
        try {
            val origen = Uri.parse(web.url ?: pedida).let { "${it.scheme}://${it.host}" }
            WebStorage.getInstance().deleteOrigin(origen)
            web.stopLoading()
            web.loadUrl("about:blank")
        } catch (e: Exception) {
            // la vista ya no existe
        }
        finish()
    }

    override fun onDestroy() {
        try {
            web.destroy()
        } catch (e: Exception) {
            // no se llegó a crear
        }
        super.onDestroy()
    }
}
