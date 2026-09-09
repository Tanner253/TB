'use client'

/**
 * Tiny WebAudio synth — no audio files, everything generated.
 * Sounds are opt-out via the header toggle (persisted in localStorage).
 * Browsers gate audio behind a user gesture, so nothing plays until the
 * visitor has interacted with the page at least once.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'tb-sound'
export const SOUND_EVENT = 'tb-soundchange'

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext }
    const Ctor = window.AudioContext || (window as AudioWindow).webkitAudioContext
    if (!Ctor) return null
    if (!audioCtx) audioCtx = new Ctor()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    /* non-persistent */
  }
  window.dispatchEvent(new CustomEvent<boolean>(SOUND_EVENT, { detail: on }))
}

function tone(
  ctx: AudioContext,
  {
    freq,
    endFreq,
    start = 0,
    duration = 0.15,
    type = 'sine',
    gain = 0.08,
  }: {
    freq: number
    endFreq?: number
    start?: number
    duration?: number
    type?: OscillatorType
    gain?: number
  }
) {
  const t0 = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration)
  amp.gain.setValueAtTime(0, t0)
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.015)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(amp).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

/** Soft UI blip — hovers, small interactions. */
export function playPop() {
  if (!isSoundEnabled()) return
  const ctx = getCtx()
  if (!ctx) return
  tone(ctx, { freq: 520, endFreq: 780, duration: 0.09, type: 'triangle', gain: 0.05 })
}

/** Cheerful whale squeak — mascot taps. */
export function playWhaleCall() {
  if (!isSoundEnabled()) return
  const ctx = getCtx()
  if (!ctx) return
  tone(ctx, { freq: 380, endFreq: 900, duration: 0.28, type: 'sine', gain: 0.07 })
  tone(ctx, { freq: 900, endFreq: 620, start: 0.26, duration: 0.22, type: 'sine', gain: 0.06 })
}

/** Payout celebration — rising arpeggio with a splashy finish. */
export function playPayoutFanfare() {
  if (!isSoundEnabled()) return
  const ctx = getCtx()
  if (!ctx) return
  const notes = [392, 494, 587, 784] // G4 B4 D5 G5
  notes.forEach((freq, i) => {
    tone(ctx, { freq, start: i * 0.11, duration: 0.22, type: 'triangle', gain: 0.07 })
  })
  // sparkle on top
  tone(ctx, { freq: 1568, start: 0.44, duration: 0.3, type: 'sine', gain: 0.04 })
  // splash — filtered noise burst
  const t0 = ctx.currentTime + 0.4
  const noiseLen = 0.5
  const buffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value = 0.8
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.06, t0)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + noiseLen)
  noise.connect(filter).connect(amp).connect(ctx.destination)
  noise.start(t0)
}

/** Countdown tick for the last seconds before a payout. */
export function playTick() {
  if (!isSoundEnabled()) return
  const ctx = getCtx()
  if (!ctx) return
  tone(ctx, { freq: 880, duration: 0.05, type: 'square', gain: 0.02 })
}

export function useSoundEnabled() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setEnabled(isSoundEnabled())
    const onChange = (e: Event) => setEnabled((e as CustomEvent<boolean>).detail)
    window.addEventListener(SOUND_EVENT, onChange)
    return () => window.removeEventListener(SOUND_EVENT, onChange)
  }, [])

  const toggle = useCallback(() => {
    const next = !isSoundEnabled()
    setSoundEnabled(next)
    setEnabled(next)
    if (next) playPop()
  }, [])

  return { enabled, toggle }
}
