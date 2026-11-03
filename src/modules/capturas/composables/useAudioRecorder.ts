import { computed, onBeforeUnmount, ref } from 'vue'
export function useAudioRecorder() {
  const state = ref<
      'IDLE' | 'REQUESTING' | 'RECORDING' | 'READY' | 'DENIED' | 'UNSUPPORTED' | 'ERROR'
    >('IDLE'),
    elapsed = ref(0),
    blob = ref<Blob | null>(null),
    error = ref(''),
    levels = ref<number[]>(Array(28).fill(0))
  let recorder: MediaRecorder | null = null,
    stream: MediaStream | null = null,
    timer: number | undefined,
    chunks: Blob[] = []
  let audioContext: AudioContext | null = null
  let animationFrame: number | null = null
  let generation = 0
  let unmounted = false
  const supported = computed(
    () =>
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined',
  )
  function cleanup() {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    animationFrame = null
    if (audioContext) void audioContext.close().catch(() => undefined)
    audioContext = null
    levels.value = Array(28).fill(0)
    if (timer) window.clearInterval(timer)
    timer = undefined
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
  }
  async function start() {
    if (unmounted || state.value === 'REQUESTING' || state.value === 'RECORDING') return
    const request = ++generation
    error.value = ''
    blob.value = null
    elapsed.value = 0
    if (!supported.value) {
      state.value = 'UNSUPPORTED'
      error.value = 'Este navegador no permite grabar audio con MediaRecorder.'
      return
    }
    state.value = 'REQUESTING'
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (request !== generation || unmounted) {
        acquired.getTracks().forEach((track) => track.stop())
        return
      }
      stream = acquired
      // Las barras reflejan la señal real del micrófono; si Web Audio no está
      // disponible, se conserva el indicador y el temporizador de grabación.
      try {
        const AudioContextType = window.AudioContext
        if (AudioContextType) {
          audioContext = new AudioContextType()
          const source = audioContext.createMediaStreamSource(acquired)
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 1024
          source.connect(analyser)
          const samples = new Uint8Array(analyser.fftSize)
          const draw = () => {
            if (state.value !== 'RECORDING') return
            analyser.getByteTimeDomainData(samples)
            const groupSize = Math.floor(samples.length / 28)
            levels.value = Array.from({ length: 28 }, (_, i) => {
              let total = 0
              for (let j = i * groupSize; j < (i + 1) * groupSize; j++)
                total += Math.abs(samples[j]! - 128) / 128
              return Math.min(1, (total / groupSize) * 5)
            })
            animationFrame = requestAnimationFrame(draw)
          }
          animationFrame = requestAnimationFrame(draw)
        }
      } catch {
        /* Visualización opcional; nunca interrumpir el dictado. */
      }
      const preferred = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find(
        (x) => MediaRecorder.isTypeSupported(x),
      )
      recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
      chunks = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      recorder.onstop = () => {
        blob.value = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
        state.value = 'READY'
        cleanup()
      }
      recorder.start()
      state.value = 'RECORDING'
      timer = window.setInterval(() => elapsed.value++, 1000)
    } catch (e) {
      if (request !== generation || unmounted) return
      cleanup()
      state.value =
        e instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(e.name)
          ? 'DENIED'
          : 'ERROR'
      error.value =
        state.value === 'DENIED'
          ? 'Permiso de micrófono denegado. Puedes usar texto o habilitarlo en el navegador.'
          : 'No fue posible iniciar la grabación.'
    }
  }
  function stop() {
    if (recorder?.state === 'recording') recorder.stop()
  }
  function cancel() {
    generation++
    if (recorder) {
      recorder.onstop = null
      if (recorder.state === 'recording') recorder.stop()
    }
    cleanup()
    recorder = null
    chunks = []
    blob.value = null
    elapsed.value = 0
    state.value = 'IDLE'
    error.value = ''
  }
  onBeforeUnmount(() => {
    unmounted = true
    cancel()
  })
  return { state, elapsed, blob, error, levels, supported, start, stop, cancel }
}
