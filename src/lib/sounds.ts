// ─── Quizout Audio Engine ─────────────────────────────────────────────────────
// Uses real MP3 files from /public/sounds/ with Web Audio API for timing control

let ctx: AudioContext | null = null
const bufferCache: Record<string, AudioBuffer> = {}

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Load and cache an audio buffer
async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  if (bufferCache[url]) return bufferCache[url]
  try {
    const ac = getCtx()
    const res = await fetch(url)
    const arr = await res.arrayBuffer()
    const buf = await ac.decodeAudioData(arr)
    bufferCache[url] = buf
    return buf
  } catch (e) {
    console.warn('Audio load failed:', url, e)
    return null
  }
}

// Preload all sounds on first user interaction
export async function preloadSounds() {
  await Promise.all([
    loadBuffer('/sounds/cheer.mp3'),
    loadBuffer('/sounds/groan.mp3'),
    loadBuffer('/sounds/whistle.mp3'),
    loadBuffer('/sounds/fanfare.mp3'),
    loadBuffer('/sounds/runup.mp3'),
  ])
}

// Play a loaded buffer with optional gain and time offset into the file
function playBuffer(url: string, gain = 1.0, offset = 0) {
  loadBuffer(url).then(buf => {
    if (!buf) return
    try {
      const ac = getCtx()
      const src = ac.createBufferSource()
      const g = ac.createGain()
      src.buffer = buf
      g.gain.value = gain
      src.connect(g)
      g.connect(ac.destination)
      src.start(0, offset)
    } catch (e) {
      console.warn('Audio play failed:', e)
    }
  })
}

// ── Public sound functions ────────────────────────────────────────────────────

// Referee whistle — play from start
export function playWhistle() {
  playBuffer('/sounds/whistle.mp3', 0.8)
}

// Run-up / tension — play from start
export function playApproach() {
  playBuffer('/sounds/runup.mp3', 0.9)
}

// Goal crowd cheer — play from start
export function playGoal() {
  playBuffer('/sounds/cheer.mp3', 1.0)
}

// Missed penalty — crowd groan
export function playMiss() {
  playBuffer('/sounds/groan.mp3', 1.0)
}

// Winner fanfare
export function playWinner() {
  playBuffer('/sounds/fanfare.mp3', 0.9)
}

// Soft tick for answer selection — synthesised, no file needed
export function playTick() {
  try {
    const ac = getCtx()
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'sine'
    o.frequency.value = 800
    g.gain.setValueAtTime(0.15, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.08)
    o.connect(g)
    g.connect(ac.destination)
    o.start()
    o.stop(ac.currentTime + 0.1)
  } catch (e) { /* ignore */ }
}
