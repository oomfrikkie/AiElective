import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchSpeech, fetchVoices } from '../api'

const KEY = 'hettie-voice'
const FADE = 0.04 // seconds of fade in/out, avoids clicks

// One audio engine for the whole app that stays open between replies. Opening and closing
// the sound output for every reply makes headphones (especially Bluetooth) crackle.
let engine = null
function getEngine() {
  if (!engine) engine = new (window.AudioContext || window.webkitAudioContext)()
  if (engine.state === 'suspended') engine.resume()
  return engine
}

// Remove markdown so it isn't read out loud ("asterisk asterisk").
function clean(text) {
  return text.replace(/[*_#`>]/g, '').replace(/^\s*[-•]\s+/gm, '').trim()
}

// Speech comes from Gemini, so it is a real Dutch voice in every browser. Browser voices
// are unreliable (Opera, for example, reads Dutch with an English voice).
// dutchOnly: false lets the voice switch between English and Dutch by itself (tutor chat).
export default function useSpeech({ dutchOnly = true } = {}) {
  const [voices, setVoices] = useState([])
  const [voice, setVoiceState] = useState(() => {
    try { return localStorage.getItem(KEY) || 'Kore' } catch { return 'Kore' }
  })
  const playing = useRef(null)
  const cache = useRef(new Map())
  const latest = useRef(0)
  const mounted = useRef(false)

  const stop = useCallback(() => {
    latest.current++
    const current = playing.current
    playing.current = null
    if (!current) return
    // Fade out instead of cutting off, which would click.
    const now = current.ctx.currentTime
    current.gain.gain.cancelScheduledValues(now)
    current.gain.gain.setValueAtTime(current.gain.gain.value, now)
    current.gain.gain.linearRampToValueAtTime(0, now + FADE)
    try { current.source.stop(now + FADE) } catch { /* already finished */ }
  }, [])

  useEffect(() => {
    mounted.current = true
    fetchVoices().then(v => mounted.current && setVoices(v)).catch(() => {})
    // Leaving the page silences Hettie, including replies that are still on their way.
    return () => {
      mounted.current = false
      stop()
    }
  }, [stop])

  const play = useCallback(async (text, withVoice) => {
    text = clean(text)
    if (!text || !mounted.current) return
    stop()
    const id = latest.current
    const key = `${withVoice}|${dutchOnly}|${text}`
    try {
      const ctx = getEngine()
      if (!cache.current.has(key)) {
        const blob = await fetchSpeech(text, withVoice, dutchOnly)
        cache.current.set(key, await ctx.decodeAudioData(await blob.arrayBuffer()))
      }
      // Skip if the page was left, or something else was asked to play meanwhile.
      if (!mounted.current || id !== latest.current) return

      const buffer = cache.current.get(key)
      const source = ctx.createBufferSource()
      const gain = ctx.createGain()
      source.buffer = buffer
      source.connect(gain).connect(ctx.destination)
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(1, now + FADE)
      gain.gain.setValueAtTime(1, now + buffer.duration - FADE)
      gain.gain.linearRampToValueAtTime(0, now + buffer.duration)
      source.start(now)
      playing.current = { ctx, source, gain }
      source.onended = () => { if (playing.current?.source === source) playing.current = null }
    } catch { /* speech unavailable; the text is still on screen */ }
  }, [stop, dutchOnly])

  const speak = useCallback(text => play(text, voice), [play, voice])

  return {
    speak, stop,
    voices,
    voice,
    // Switch voice and play a short sample with it.
    setVoice: name => {
      setVoiceState(name)
      try { localStorage.setItem(KEY, name) } catch { /* storage unavailable */ }
      play('Hallo! Ik ben Hettie.', name)
    },
  }
}
