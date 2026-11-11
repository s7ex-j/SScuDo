package pe.s7ex.sscudo

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import org.json.JSONTokener

/**
 * El motor de análisis es el mismo JavaScript de la web (assets/motor.js).
 * Se ejecuta en un WebView sin interfaz y con la red bloqueada: recibe texto,
 * devuelve un resumen. Se crea cuando hace falta y se apaga al rato de no usarse.
 */
object Motor {
    private const val REPOSO_MS = 90_000L

    private val principal = Handler(Looper.getMainLooper())
    private var web: WebView? = null
    private var listo = false
    private val pendientes = ArrayDeque<Pair<String, (JSONObject?) -> Unit>>()
    private val apagar = Runnable { destruir() }

    /** Analiza un mensaje. La respuesta llega en el hilo principal; null si algo falló. */
    fun mensaje(ctx: Context, texto: String, alTerminar: (JSONObject?) -> Unit) {
        evaluar(ctx, "SScuDo.resumenMensaje(" + JSONObject.quote(texto.take(6000)) + ")", alTerminar)
    }

    /** Analiza la dirección de una página. */
    fun pagina(ctx: Context, url: String, alTerminar: (JSONObject?) -> Unit) {
        evaluar(ctx, "SScuDo.resumenPagina(" + JSONObject.quote(url.take(2000)) + ")", alTerminar)
    }

    private fun evaluar(ctx: Context, expresion: String, alTerminar: (JSONObject?) -> Unit) {
        principal.post {
            try {
                pendientes.addLast(expresion to alTerminar)
                if (web == null) crear(ctx.applicationContext)
                if (listo) vaciar()
            } catch (e: Throwable) {
                pendientes.clear()
                alTerminar(null)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun crear(app: Context) {
        val fuente = app.assets.open("motor.js").bufferedReader().use { it.readText() }
        val w = WebView(app)
        w.settings.javaScriptEnabled = true
        w.settings.blockNetworkLoads = true
        w.settings.allowFileAccess = false
        w.settings.allowContentAccess = false
        w.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                view.evaluateJavascript(fuente) {
                    listo = true
                    vaciar()
                }
            }
        }
        web = w
        listo = false
        w.loadDataWithBaseURL("about:blank", "<!doctype html><html><body></body></html>", "text/html", "utf-8", null)
    }

    private fun vaciar() {
        val w = web ?: return
        while (pendientes.isNotEmpty()) {
            val (expresion, alTerminar) = pendientes.removeFirst()
            w.evaluateJavascript("(function(){try{return $expresion}catch(e){return null}})()") { crudo ->
                alTerminar(leer(crudo))
            }
        }
        principal.removeCallbacks(apagar)
        principal.postDelayed(apagar, REPOSO_MS)
    }

    /** evaluateJavascript devuelve el resultado como literal JSON: aquí, una cadena que contiene JSON. */
    private fun leer(crudo: String?): JSONObject? {
        if (crudo == null || crudo == "null") return null
        return try {
            val interior = JSONTokener(crudo).nextValue() as? String ?: return null
            JSONObject(interior)
        } catch (e: Exception) {
            null
        }
    }

    private fun destruir() {
        if (pendientes.isNotEmpty()) return
        web?.destroy()
        web = null
        listo = false
    }
}
