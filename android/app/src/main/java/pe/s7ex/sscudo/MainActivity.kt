package pe.s7ex.sscudo

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader

/**
 * Pantalla principal: la misma interfaz de la web, servida desde los archivos
 * de la app (no desde internet). Recibe texto por "Compartir", por la
 * selección de texto ("Revisar con SScuDo") o desde una alerta propia.
 */
class MainActivity : Activity() {

    companion object {
        const val EXTRA_TEXTO = "pe.s7ex.sscudo.TEXTO"
        /** Dirección para revisar en el servicio sin abrirla (desde el aviso de enlace). */
        const val EXTRA_PAGINA = "pe.s7ex.sscudo.PAGINA"
        /** Revisar lo copiado (desde el botón de ajustes rápidos). */
        const val EXTRA_PORTAPAPELES = "pe.s7ex.sscudo.PORTAPAPELES"
        /** Hay una revisión de página lista en PaginaActivity.resultado. */
        const val EXTRA_REVISION = "pe.s7ex.sscudo.REVISION"
        private const val ANFITRION = "appassets.androidplatform.net"
        private const val INICIO = "https://$ANFITRION/assets/web/app/index.html"
    }

    private lateinit var web: WebView
    private var cargada = false
    /** Android solo deja leer lo copiado cuando la app tiene el foco: se espera a tenerlo. */
    private var leerAlEnfocar = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val archivos = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        web.setBackgroundColor(0xFFEDF0F3.toInt())
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        web.addJavascriptInterface(Puente(this), "SScuDoAndroid")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return archivos.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == ANFITRION) return false
                // Enlaces hacia afuera (fuentes, GitHub): se abren en el navegador.
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                } catch (e: Exception) {
                    // sin navegador disponible: no se hace nada
                }
                return true
            }

            override fun onPageFinished(view: WebView, url: String?) {
                cargada = true
            }
        }
        setContentView(web)

        leerAlEnfocar = intent?.getBooleanExtra(EXTRA_PORTAPAPELES, false) == true
        web.loadUrl(INICIO + (fragmentoDe(intent)?.let { "#$it" } ?: ""))
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus || !leerAlEnfocar) return
        leerAlEnfocar = false
        val copiado = Puente.leerPortapapeles(this)
        if (copiado.isBlank()) {
            android.widget.Toast.makeText(this, "No hay texto copiado. Copia el mensaje y vuelve a tocar el botón.", android.widget.Toast.LENGTH_LONG).show()
            return
        }
        enviar("texto=" + Uri.encode(copiado.take(6000)))
    }

    private fun enviar(fragmento: String) {
        if (cargada) {
            web.evaluateJavascript("location.hash = " + org.json.JSONObject.quote(fragmento), null)
        } else {
            web.loadUrl("$INICIO#$fragmento")
        }
    }

    /** Lo que trae el intent, como fragmento de la web (#texto=... o #pagina=...). */
    private fun fragmentoDe(intent: Intent?): String? {
        if (intent?.getBooleanExtra(EXTRA_REVISION, false) == true) return "revision=" + System.currentTimeMillis()
        val pagina = intent?.getStringExtra(EXTRA_PAGINA)
        if (!pagina.isNullOrBlank()) return "pagina=" + Uri.encode(pagina.take(2000))
        return textoDe(intent)?.let { "texto=" + Uri.encode(it) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(EXTRA_PORTAPAPELES, false)) {
            leerAlEnfocar = true
            if (hasWindowFocus()) onWindowFocusChanged(true)
            return
        }
        enviar(fragmentoDe(intent) ?: return)
    }

    private fun textoDe(intent: Intent?): String? {
        if (intent == null) return null
        val texto: CharSequence? = when (intent.action) {
            Intent.ACTION_SEND -> intent.getCharSequenceExtra(Intent.EXTRA_TEXT)
            Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)
            else -> intent.getStringExtra(EXTRA_TEXTO)
        }
        val limpio = texto?.toString()?.trim().orEmpty()
        return if (limpio.isEmpty()) null else limpio.take(6000)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}
