// src/lib/notification-sound.ts — iOS-safe audio manager for kitchen alerts
// iOS/iPad requires a user gesture to unlock AudioContext before any sound can play.
// This module handles that unlock + provides a simple play() API.

type SoundName = "new-order" | "alert" | "ready" | "tick";

const SOUND_URLS: Record<SoundName, string> = {
  "new-order": "/sounds/new-order.wav",
  alert: "/sounds/alert.wav",
  ready: "/sounds/ready.wav",
  tick: "/sounds/tick.wav",
};

class NotificationSoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private _unlocked = false;

  get unlocked() {
    return this._unlocked;
  }

  /** Call this on a user gesture (tap/click) to unlock iOS audio */
  async unlock(): Promise<boolean> {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
      }
      // Resume if suspended (iOS suspends by default)
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      // Play a silent buffer to fully unlock iOS audio
      const silent = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = silent;
      source.connect(this.ctx.destination);
      source.start(0);

      this._unlocked = true;

      // Pre-load all sounds
      await this.preload();
      return true;
    } catch {
      return false;
    }
  }

  private async preload() {
    if (!this.ctx) return;
    const entries = Object.entries(SOUND_URLS) as [SoundName, string][];
    await Promise.allSettled(
      entries.map(async ([name, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
          this.buffers.set(name, audioBuffer);
        } catch {
          // Sound file missing — non-critical
        }
      })
    );
  }

  /** Play a named sound. Falls back to HTML5 Audio if WebAudio fails. */
  play(name: SoundName, volume = 0.8) {
    // Try WebAudio first (lower latency)
    if (this.ctx && this._unlocked) {
      const buffer = this.buffers.get(name);
      if (buffer) {
        try {
          const source = this.ctx.createBufferSource();
          const gain = this.ctx.createGain();
          gain.gain.value = volume;
          source.buffer = buffer;
          source.connect(gain);
          gain.connect(this.ctx.destination);
          source.start(0);
          return;
        } catch {
          // Fall through to HTML5
        }
      }
    }
    // Fallback: HTML5 Audio
    try {
      const url = SOUND_URLS[name];
      if (!url) return;
      const audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(() => {});
    } catch {
      // Audio not available
    }
  }

  /** Play the new order alert: 3 beeps */
  playNewOrderAlert() {
    this.play("new-order", 1.0);
    // Repeat beeps
    setTimeout(() => this.play("new-order", 0.9), 1500);
    setTimeout(() => this.play("new-order", 0.8), 3000);
  }

  /** Vibrate device (tablet) */
  vibrate(pattern: number[] = [200, 100, 200, 100, 200]) {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Not supported
    }
  }
}

// Singleton
export const soundManager = new NotificationSoundManager();
