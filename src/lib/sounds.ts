// src/lib/sounds.ts — 3 notification sounds for boucher kitchen mode
// Marimba Song, Steel Pan, Koto Japonais — all synthesized via Web Audio API

// ═══════════ MARIMBA SONG (défaut) ═══════════
export function playMarimbaSong() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.85
    master.connect(ctx.destination)

    const notes = [
      { f: 196, t: 0, d: 0.8 },
      { f: 246.9, t: 0.22, d: 0.7 },
      { f: 293.7, t: 0.44, d: 0.65 },
      { f: 392, t: 0.66, d: 1.0 },
      { f: 196, t: 1.4, d: 0.8 },
      { f: 246.9, t: 1.62, d: 0.7 },
      { f: 293.7, t: 1.84, d: 0.65 },
      { f: 392, t: 2.06, d: 1.2 },
    ]
    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      gain.gain.setValueAtTime(0, now + t)
      gain.gain.linearRampToValueAtTime(0.5, now + t + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + t)
      osc.stop(now + t + d + 0.05)

      const h = ctx.createOscillator()
      const hg = ctx.createGain()
      h.type = 'sine'
      h.frequency.value = f * 4
      hg.gain.setValueAtTime(0, now + t)
      hg.gain.linearRampToValueAtTime(0.06, now + t + 0.003)
      hg.gain.exponentialRampToValueAtTime(0.001, now + t + d * 0.3)
      h.connect(hg)
      hg.connect(master)
      h.start(now + t)
      h.stop(now + t + d * 0.4)

      const sub = ctx.createOscillator()
      const sg = ctx.createGain()
      sub.type = 'sine'
      sub.frequency.value = f / 2
      sg.gain.setValueAtTime(0, now + t)
      sg.gain.linearRampToValueAtTime(0.2, now + t + 0.005)
      sg.gain.exponentialRampToValueAtTime(0.001, now + t + d * 0.8)
      sub.connect(sg)
      sg.connect(master)
      sub.start(now + t)
      sub.stop(now + t + d + 0.05)

      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.008, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 10)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const ng = ctx.createGain()
      ng.gain.value = 0.15
      src.connect(ng)
      ng.connect(master)
      src.start(now + t)
    })
    if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 100, 60, 200])
    setTimeout(() => ctx.close().catch(() => {}), 4000)
  } catch (e) {
    console.error('Marimba Song error:', e)
  }
}

// ═══════════ STEEL PAN ═══════════
export function playSteelPan() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.85
    master.connect(ctx.destination)

    const notes = [
      { f: 261.6, t: 0, d: 0.7 },
      { f: 330, t: 0.18, d: 0.65 },
      { f: 392, t: 0.36, d: 0.6 },
      { f: 523.3, t: 0.54, d: 0.9 },
      { f: 261.6, t: 1.2, d: 0.7 },
      { f: 330, t: 1.38, d: 0.65 },
      { f: 392, t: 1.56, d: 0.6 },
      { f: 523.3, t: 1.74, d: 1.1 },
    ]
    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f * 1.01, now + t)
      osc.frequency.exponentialRampToValueAtTime(f, now + t + 0.02)
      gain.gain.setValueAtTime(0, now + t)
      gain.gain.linearRampToValueAtTime(0.5, now + t + 0.003)
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + t)
      osc.stop(now + t + d + 0.05)

      const h2 = ctx.createOscillator()
      const h2g = ctx.createGain()
      h2.type = 'sine'
      h2.frequency.value = f * 2
      h2g.gain.setValueAtTime(0, now + t)
      h2g.gain.linearRampToValueAtTime(0.18, now + t + 0.003)
      h2g.gain.exponentialRampToValueAtTime(0.001, now + t + d * 0.5)
      h2.connect(h2g)
      h2g.connect(master)
      h2.start(now + t)
      h2.stop(now + t + d * 0.6)

      const h4 = ctx.createOscillator()
      const h4g = ctx.createGain()
      h4.type = 'sine'
      h4.frequency.value = f * 4
      h4g.gain.setValueAtTime(0, now + t)
      h4g.gain.linearRampToValueAtTime(0.04, now + t + 0.003)
      h4g.gain.exponentialRampToValueAtTime(0.001, now + t + d * 0.2)
      h4.connect(h4g)
      h4g.connect(master)
      h4.start(now + t)
      h4.stop(now + t + d * 0.3)

      const sub = ctx.createOscillator()
      const sg = ctx.createGain()
      sub.type = 'sine'
      sub.frequency.value = f / 2
      sg.gain.setValueAtTime(0, now + t)
      sg.gain.linearRampToValueAtTime(0.12, now + t + 0.004)
      sg.gain.exponentialRampToValueAtTime(0.001, now + t + d * 0.6)
      sub.connect(sg)
      sg.connect(master)
      sub.start(now + t)
      sub.stop(now + t + d * 0.7)

      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.006, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 12)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const ng = ctx.createGain()
      ng.gain.value = 0.1
      src.connect(ng)
      ng.connect(master)
      src.start(now + t)
    })
    if (navigator.vibrate) navigator.vibrate([80, 50, 80, 50, 80, 50, 150, 300, 80, 50, 80, 50, 80, 50, 150])
    setTimeout(() => ctx.close().catch(() => {}), 4000)
  } catch (e) {
    console.error('Steel Pan error:', e)
  }
}

// ═══════════ KOTO JAPONAIS ═══════════
export function playKoto() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)

    const notes = [
      { f: 220, t: 0, d: 0.8 },
      { f: 294, t: 0.2, d: 0.7 },
      { f: 330, t: 0.4, d: 0.65 },
      { f: 440, t: 0.6, d: 1.0 },
      { f: 330, t: 1.1, d: 0.6 },
      { f: 440, t: 1.3, d: 1.2 },
    ]
    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = f
      gain.gain.setValueAtTime(0, now + t)
      gain.gain.linearRampToValueAtTime(0.3, now + t + 0.002)
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(f * 8, now + t)
      filter.frequency.exponentialRampToValueAtTime(f * 2, now + t + d * 0.5)
      filter.Q.value = 1
      osc.connect(gain)
      gain.connect(filter)
      filter.connect(master)
      osc.start(now + t)
      osc.stop(now + t + d + 0.05)

      const res = ctx.createOscillator()
      const rg = ctx.createGain()
      res.type = 'sine'
      res.frequency.value = f
      rg.gain.setValueAtTime(0, now + t)
      rg.gain.linearRampToValueAtTime(0.25, now + t + 0.003)
      rg.gain.exponentialRampToValueAtTime(0.001, now + t + d * 0.9)
      res.connect(rg)
      rg.connect(master)
      res.start(now + t)
      res.stop(now + t + d + 0.05)

      const sub = ctx.createOscillator()
      const sg = ctx.createGain()
      sub.type = 'sine'
      sub.frequency.value = f / 2
      sg.gain.setValueAtTime(0, now + t)
      sg.gain.linearRampToValueAtTime(0.15, now + t + 0.004)
      sg.gain.exponentialRampToValueAtTime(0.001, now + t + d * 0.6)
      sub.connect(sg)
      sg.connect(master)
      sub.start(now + t)
      sub.stop(now + t + d * 0.7)

      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.01, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 6)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const ng = ctx.createGain()
      ng.gain.value = 0.18
      const nf = ctx.createBiquadFilter()
      nf.type = 'highpass'
      nf.frequency.value = 1000
      src.connect(nf)
      nf.connect(ng)
      ng.connect(master)
      src.start(now + t)
    })
    if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 100, 60, 200, 100, 60, 200])
    setTimeout(() => ctx.close().catch(() => {}), 4000)
  } catch (e) {
    console.error('Koto error:', e)
  }
}

// ═══════════ SOUND SELECTION SYSTEM ═══════════
export type SoundType = 'marimba' | 'steelpan' | 'koto'

export const SOUND_OPTIONS: { key: SoundType; label: string; emoji: string }[] = [
  { key: 'marimba', label: 'Marimba Song', emoji: '🪘' },
  { key: 'steelpan', label: 'Steel Pan', emoji: '🌴' },
  { key: 'koto', label: 'Koto Japonais', emoji: '🎌' },
]

const SOUND_MAP: Record<SoundType, () => void> = {
  marimba: playMarimbaSong,
  steelpan: playSteelPan,
  koto: playKoto,
}

export function getSelectedSound(): SoundType {
  if (typeof window === 'undefined') return 'marimba'
  return (localStorage.getItem('klikgo_sound') as SoundType) || 'marimba'
}

export function setSelectedSound(sound: SoundType) {
  localStorage.setItem('klikgo_sound', sound)
}

export function playSelectedSound() {
  const sound = getSelectedSound()
  SOUND_MAP[sound]()
}

// ═══════════ ALERT LOOP ═══════════
let alertInterval: ReturnType<typeof setInterval> | null = null

export function startOrderAlert() {
  stopOrderAlert()
  playSelectedSound()
  alertInterval = setInterval(() => {
    playSelectedSound()
  }, 5000)
}

export function stopOrderAlert() {
  if (alertInterval) {
    clearInterval(alertInterval)
    alertInterval = null
  }
}
