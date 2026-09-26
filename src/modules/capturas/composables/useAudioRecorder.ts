import { computed, onBeforeUnmount, ref } from 'vue'
export function useAudioRecorder() {
  const state = ref<
      'IDLE' | 'REQUESTING' | 'RECORDING' | 'READY' | 'DENIED' | 'UNSUPPORTED' | 'ERROR'
    >('IDLE'),
    elapsed = ref(0),
    blob = ref<Blob | null>(null),
    error = ref('')
  let recorder: MediaRecorder | null = null,
    stream: MediaStream | null = null,
    timer: number | undefined,
    chunks: Blob[] = []
  const supported = computed(
    () =>
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined',
  )
  function cleanup() {
    if (timer) window.clearInterval(timer)
    timer = undefined
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
  }
  async function start() {
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
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
  onBeforeUnmount(cancel)
  return { state, elapsed, blob, error, supported, start, stop, cancel }
}
