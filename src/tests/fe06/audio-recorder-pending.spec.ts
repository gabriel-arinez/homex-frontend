import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AudioRecorder from '@/modules/capturas/components/AudioRecorder.vue'

function setup() {
  let resolve!: (stream: MediaStream) => void
  const getUserMedia = vi.fn<() => Promise<MediaStream>>(
    () => new Promise<MediaStream>((r) => (resolve = r)),
  )
  const stopTrack = vi.fn<() => void>()
  const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  class Recorder {
    static isTypeSupported() {
      return true
    }
    state = 'inactive'
    mimeType = 'audio/webm'
    onstop: (() => void) | null = null
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    constructor(_stream: MediaStream) {}
    start() {
      this.state = 'recording'
    }
    pause() {
      this.state = 'paused'
    }
    resume() {
      this.state = 'recording'
    }
    stop() {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['audio']) })
      this.onstop?.()
    }
  }
  vi.stubGlobal('MediaRecorder', Recorder)
  return { getUserMedia, stopTrack, stream, resolve: () => resolve(stream) }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function controls(wrapper: ReturnType<typeof mount>) {
  return (
    wrapper.vm.$ as unknown as {
      setupState: {
        r: {
          start: () => Promise<void>
          pause: () => void
          resume: () => void
          stop: () => void
          cancel: () => void
        }
      }
    }
  ).setupState.r
}

describe('recorder pending permission', () => {
  it('discards a late stream after cancel and allows a new capture', async () => {
    const media = setup()
    vi.useFakeTimers()
    const wrapper = mount(AudioRecorder)
    const first = controls(wrapper).start()
    const duplicate = controls(wrapper).start()
    expect(media.getUserMedia).toHaveBeenCalledTimes(1)
    controls(wrapper).cancel()
    media.resolve()
    await Promise.all([first, duplicate])
    await flushPromises()
    expect(media.stopTrack).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('Grabando')
    expect(wrapper.emitted('ready')).toBeUndefined()
    const second = controls(wrapper).start()
    media.resolve()
    await second
    expect(wrapper.text()).toContain('Grabando')
    await vi.advanceTimersByTimeAsync(15000)
    controls(wrapper).stop()
    await flushPromises()
    expect(wrapper.text()).toContain('Audio listo')
    expect(media.stopTrack).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('pausa y reanuda sin descartar audio, y acepta finalizar desde pausa', async () => {
    const media = setup()
    vi.useFakeTimers()
    const wrapper = mount(AudioRecorder)
    const pending = controls(wrapper).start()
    media.resolve()
    await pending
    controls(wrapper).pause()
    await flushPromises()
    expect(wrapper.text()).toContain('Pausado')
    controls(wrapper).resume()
    await flushPromises()
    expect(wrapper.text()).toContain('Grabando')
    await vi.advanceTimersByTimeAsync(15000)
    controls(wrapper).pause()
    controls(wrapper).stop()
    await flushPromises()
    expect(wrapper.text()).toContain('Audio listo')
    expect(media.stopTrack).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('stops a stream received after unmount without creating audio', async () => {
    const media = setup()
    vi.useFakeTimers()
    const wrapper = mount(AudioRecorder)
    const pending = controls(wrapper).start()
    wrapper.unmount()
    media.resolve()
    await pending
    expect(media.stopTrack).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('ready')).toBeUndefined()
  })
})

it.each([14, 15, 16, 240, 241])(
  'enforces operational microphone bounds at %s seconds',
  async (seconds) => {
    const media = setup()
    vi.useFakeTimers()
    const wrapper = mount(AudioRecorder)
    const pending = controls(wrapper).start()
    media.resolve()
    await pending
    await vi.advanceTimersByTimeAsync(seconds * 1000)
    controls(wrapper).stop()
    await flushPromises()
    const ready = wrapper.emitted('ready')?.filter(([blob]) => blob instanceof Blob) ?? []
    expect(ready.length).toBe(seconds < 15 ? 0 : 1)
    expect(wrapper.text().includes('15 segundos')).toBe(seconds < 15)
    // Auto-stop at 240 prevents a 241-second recording, rather than sending oversized audio.
    expect(wrapper.text().includes('04:01')).toBe(false)
    wrapper.unmount()
  },
)
