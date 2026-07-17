package com.emergent.completepromptpdf.jvd1n5

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.app.*
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import java.nio.FloatBuffer
import java.util.ArrayDeque

/**
 * Foreground service that keeps the microphone hot for wake-word detection
 * ("Hello Sara" / "Hey Sara") using OpenWakeWord's ONNX pipeline, run
 * on-device via ONNX Runtime — no Porcupine, no license key.
 *
 * Pipeline (this is OpenWakeWord's standard 3-stage architecture):
 *   raw 16kHz audio -> melspectrogram.onnx -> mel frames
 *   mel frames (stacked)  -> embedding_model.onnx -> 96-dim embeddings
 *   embeddings (stacked)  -> hey_sara.onnx (classifier) -> wake score
 *
 * Files the app owner supplies (never bundled in this repo — see
 * plugins/hello-sara-native/README.md):
 *   1. melspectrogram.onnx  — shared, unmodified file from the OpenWakeWord
 *      repo (github.com/dscripka/openWakeWord), same for every keyword.
 *   2. embedding_model.onnx — shared, unmodified file, same source.
 *   3. hey_sara.onnx        — the ONLY file that's actually custom-trained
 *      for "Hello Sara" / "Hey Sara" (via OpenWakeWord's training pipeline).
 * All three go in frontend/plugins/hello-sara-native/android/assets/ and
 * the config plugin copies them into the built app automatically.
 *
 * On detection this calls onWakeWordDetected() — UNCHANGED from before —
 * which launches MainActivity via the existing frontend://chat?autostart=1
 * deep link. Everything downstream (speech recognition auto-start, command
 * router, AI, TTS) is untouched.
 */
class WakeWordService : Service() {
    private val TAG = "WakeWordService"

    // --- Audio capture ---
    private var audioRecord: AudioRecord? = null
    private var captureThread: Thread? = null
    @Volatile private var running = false

    private val SAMPLE_RATE = 16000
    private val CHUNK_SAMPLES = 1280 // 80ms @ 16kHz — OpenWakeWord's step size

    // --- ONNX Runtime ---
    private lateinit var ortEnv: OrtEnvironment
    private var melSession: OrtSession? = null
    private var embedSession: OrtSession? = null
    private var wakeSession: OrtSession? = null

    // Rolling buffers for the 3-stage pipeline.
    private val melFrameBuffer = ArrayDeque<FloatArray>()   // keep last 76 mel frames (each 32 bins)
    private val embeddingBuffer = ArrayDeque<FloatArray>()  // keep last 16 embeddings (each 96-dim)
    private val MEL_WINDOW = 76
    private val EMBED_WINDOW = 16

    private val DETECTION_THRESHOLD = 0.5f
    private var consecutiveHits = 0
    private val HITS_TO_TRIGGER = 2       // small debounce to avoid one-frame false positives
    private var cooldownUntil = 0L
    private val COOLDOWN_MS = 3000L        // avoid re-triggering while the app is already opening

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val channelId = "hello_sara_wake"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(channelId, "Sara listening", NotificationManager.IMPORTANCE_LOW)
            mgr.createNotificationChannel(channel)
        }
        val notif = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Sara")
            .setContentText("Listening for \"Hello Sara\"")
            .setOngoing(true)
            .build()
        startForeground(1042, notif)

        startWakeWordEngine()

        return START_STICKY
    }

    // ---------------------------------------------------------------
    // Engine setup
    // ---------------------------------------------------------------

    private fun startWakeWordEngine() {
        if (!loadModels()) return // logs its own reason and bails out

        if (!hasMicPermission()) {
            Log.w(TAG, "RECORD_AUDIO not granted — wake word disabled until permission is granted.")
            return
        }

        val minBuf = AudioRecord.getMinBufferSize(
            SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
        )
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
            maxOf(minBuf, CHUNK_SAMPLES * 4),
        )

        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord failed to initialize.")
            return
        }

        running = true
        audioRecord?.startRecording()

        captureThread = Thread {
            val buffer = ShortArray(CHUNK_SAMPLES)
            while (running) {
                val read = audioRecord?.read(buffer, 0, CHUNK_SAMPLES) ?: -1
                if (read > 0) {
                    try {
                        processChunk(buffer, read)
                    } catch (e: Exception) {
                        Log.e(TAG, "Inference error: ${e.message}")
                    }
                }
            }
        }
        captureThread?.isDaemon = true
        captureThread?.start()
    }

    private fun loadModels(): Boolean {
        val melPath = "melspectrogram.onnx"
        val embedPath = "embedding_model.onnx"
        val wakePath = "hey_sara.onnx"

        for (f in listOf(melPath, embedPath, wakePath)) {
            if (!assetExists(f)) {
                Log.w(TAG, "$f not found in assets — see plugins/hello-sara-native/README.md to add it. Wake word disabled.")
                return false
            }
        }

        return try {
            ortEnv = OrtEnvironment.getEnvironment()
            melSession = ortEnv.createSession(readAssetBytes(melPath), OrtSession.SessionOptions())
            embedSession = ortEnv.createSession(readAssetBytes(embedPath), OrtSession.SessionOptions())
            wakeSession = ortEnv.createSession(readAssetBytes(wakePath), OrtSession.SessionOptions())
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load ONNX models: ${e.message}")
            false
        }
    }

    // ---------------------------------------------------------------
    // Per-chunk pipeline: audio -> mel -> embedding -> wake score
    // ---------------------------------------------------------------

    private fun processChunk(pcm: ShortArray, len: Int) {
        val melSession = melSession ?: return
        val embedSession = embedSession ?: return
        val wakeSession = wakeSession ?: return

        // int16 PCM -> float32 in [-1, 1], the format melspectrogram.onnx expects.
        val floatAudio = FloatArray(len) { pcm[it] / 32768f }

        // --- Stage 1: melspectrogram ---
        val melInputName = melSession.inputNames.iterator().next()
        val melInput = OnnxTensor.createTensor(ortEnv, FloatBuffer.wrap(floatAudio), longArrayOf(1, len.toLong()))
        val melOut = melSession.run(mapOf(melInputName to melInput))
        val melFrames = extractMelFrames(melOut)
        melOut.close()
        melInput.close()
        if (melFrames.isEmpty()) return

        for (frame in melFrames) {
            melFrameBuffer.addLast(frame)
            while (melFrameBuffer.size > MEL_WINDOW) melFrameBuffer.removeFirst()
        }
        if (melFrameBuffer.size < MEL_WINDOW) return // still warming up

        // --- Stage 2: embedding (consumes the last MEL_WINDOW mel frames) ---
        val melBins = melFrameBuffer.first().size
        val stacked = FloatArray(MEL_WINDOW * melBins)
        melFrameBuffer.forEachIndexed { i, frame -> System.arraycopy(frame, 0, stacked, i * melBins, melBins) }

        val embedInputName = embedSession.inputNames.iterator().next()
        val embedInput = OnnxTensor.createTensor(
            ortEnv, FloatBuffer.wrap(stacked), longArrayOf(1, MEL_WINDOW.toLong(), melBins.toLong(), 1),
        )
        val embedOut = embedSession.run(mapOf(embedInputName to embedInput))
        val embedding = extractEmbedding(embedOut)
        embedOut.close()
        embedInput.close()
        if (embedding.isEmpty()) return

        embeddingBuffer.addLast(embedding)
        while (embeddingBuffer.size > EMBED_WINDOW) embeddingBuffer.removeFirst()
        if (embeddingBuffer.size < EMBED_WINDOW) return // still warming up

        // --- Stage 3: wake-word classifier (consumes the last EMBED_WINDOW embeddings) ---
        val embedDim = embeddingBuffer.first().size
        val stackedEmbed = FloatArray(EMBED_WINDOW * embedDim)
        embeddingBuffer.forEachIndexed { i, e -> System.arraycopy(e, 0, stackedEmbed, i * embedDim, embedDim) }

        val wakeInputName = wakeSession.inputNames.iterator().next()
        val wakeInput = OnnxTensor.createTensor(
            ortEnv, FloatBuffer.wrap(stackedEmbed), longArrayOf(1, EMBED_WINDOW.toLong(), embedDim.toLong()),
        )
        val wakeOut = wakeSession.run(mapOf(wakeInputName to wakeInput))
        val score = extractScore(wakeOut)
        wakeOut.close()
        wakeInput.close()

        evaluateScore(score)
    }

    private fun evaluateScore(score: Float) {
        val now = System.currentTimeMillis()
        if (now < cooldownUntil) return

        if (score >= DETECTION_THRESHOLD) {
            consecutiveHits++
            if (consecutiveHits >= HITS_TO_TRIGGER) {
                consecutiveHits = 0
                cooldownUntil = now + COOLDOWN_MS
                onWakeWordDetected()
            }
        } else {
            consecutiveHits = 0
        }
    }

    // ---------------------------------------------------------------
    // Tensor -> array extraction helpers.
    // NOTE: exact output shapes can vary slightly by ONNX export version —
    // if your models' output tensors differ, adjust these three
    // extraction helpers only; nothing else in the pipeline needs to change.
    // ---------------------------------------------------------------

    @Suppress("UNCHECKED_CAST")
    private fun extractMelFrames(result: OrtSession.Result): List<FloatArray> {
        val raw = result[0].value
        // Expected shape roughly [1, numFrames, 32] — flatten defensively.
        val frames = mutableListOf<FloatArray>()
        when (raw) {
            is Array<*> -> {
                val batch = raw[0]
                if (batch is Array<*>) {
                    for (f in batch) if (f is FloatArray) frames.add(f)
                }
            }
        }
        return frames
    }

    @Suppress("UNCHECKED_CAST")
    private fun extractEmbedding(result: OrtSession.Result): FloatArray {
        val raw = result[0].value
        // Expected shape roughly [1, 1, 1, 96] or [1, 96] — flatten defensively.
        fun flatten(v: Any?): FloatArray {
            return when (v) {
                is FloatArray -> v
                is Array<*> -> v.flatMap { flatten(it).toList() }.toFloatArray()
                else -> floatArrayOf()
            }
        }
        return flatten(raw)
    }

    private fun extractScore(result: OrtSession.Result): Float {
        val raw = result[0].value
        fun firstFloat(v: Any?): Float {
            return when (v) {
                is FloatArray -> v.firstOrNull() ?: 0f
                is Array<*> -> firstFloat(v.firstOrNull())
                is Float -> v
                else -> 0f
            }
        }
        return firstFloat(raw)
    }

    // ---------------------------------------------------------------
    // Unchanged from before — this is the existing trigger the rest of
    // the app (deep link -> chat.tsx autostart) already relies on.
    // ---------------------------------------------------------------
    private fun onWakeWordDetected() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("frontend://chat?autostart=1")).apply {
            setPackage(applicationContext.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }
        startActivity(intent)
    }

    private fun hasMicPermission(): Boolean {
        return checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    private fun assetExists(name: String): Boolean {
        return try { assets.open(name).close(); true } catch (e: Exception) { false }
    }

    private fun readAssetBytes(name: String): ByteArray {
        return assets.open(name).use { it.readBytes() }
    }

    override fun onDestroy() {
        running = false
        try { audioRecord?.stop() } catch (e: Exception) {}
        audioRecord?.release()
        melSession?.close()
        embedSession?.close()
        wakeSession?.close()
        super.onDestroy()
    }
}
