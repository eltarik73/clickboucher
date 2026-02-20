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
      // Tone boisée principale (triangle)
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

      // Harmonique haute (brillance bois)
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

      // Sub basse (profondeur)
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

      // Click d'attaque mallet
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

    // Vibration mobile
    if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 100, 60, 200])

    // Fermer le contexte après la fin du son
    setTimeout(() => ctx.close().catch(() => {}), 4000)
  } catch (e) {
    console.error('Marimba Song error:', e)
  }
}

// Son persistant : rejoue en boucle jusqu'à réponse
let alertInterval: ReturnType<typeof setInterval> | null = null

export function startOrderAlert() {
  stopOrderAlert()
  playMarimbaSong()
  alertInterval = setInterval(() => {
    playMarimbaSong()
  }, 5000) // Rejoue toutes les 5 secondes
}

export function stopOrderAlert() {
  if (alertInterval) {
    clearInterval(alertInterval)
    alertInterval = null
  }
}
