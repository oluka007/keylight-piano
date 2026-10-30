// Camera hand tracking (first version, in the spirit of the Airwave add-on).
//
// A camera looks down at the keyboard; Google's MediaPipe Hand Landmarker (Apache-2.0,
// runs locally on the GPU) finds 21 points per hand. After calibration (where the key
// row's left and right ends are in the picture), each fingertip is turned into a
// position along the 24 keys, so the app knows which finger is over which key before
// it is pressed.
//
// Calibration can be automatic: the app lights the first and last key, compares a
// frame with them lit against a frame with them dark, and takes the two brightest
// changed spots as the ends of the key row.

const WASM_DIR = 'vendor/mediapipe/wasm'
const MODEL = 'models/hand_landmarker.task'

// MediaPipe landmark indices of the fingertips, thumb first (finger numbers 1–5).
export const TIPS = [4, 8, 12, 16, 20]
// Bones to draw: wrist → each finger.
export const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]]

let vision = null
let landmarker = null

async function loadLandmarker() {
  if (landmarker) return landmarker
  vision = await import('./vendor/mediapipe/vision_bundle.mjs')
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_DIR)
  landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  })
  return landmarker
}

export async function listCameras() {
  // labels are only filled in once camera permission has been granted
  const all = await navigator.mediaDevices.enumerateDevices()
  return all.filter((d) => d.kind === 'videoinput').map((d) => ({ id: d.deviceId, label: d.label || 'Camera' }))
}

export class HandTracker {
  constructor() {
    this.video = document.createElement('video')
    this.video.muted = true
    this.video.playsInline = true
    this.stream = null
    this.running = false
    this.hands = []            // [{ side: 'left'|'right', points: [{x,y,z}] (0..1 image coords) }]
    this.calib = null          // { a: {x,y}, b: {x,y} } ends of the key row, image coords
    this.mirror = false
    this.onFrame = () => {}
    this.onEnded = () => {}
    this.active = true         // the app pauses detection on screens that don't use it
    this.lastSeen = 0          // when hands were last detected (performance.now)
    this._lastTs = -1
  }

  // video width / height, so projections measure distances the same in x and y
  get aspect() { return this.video.videoWidth && this.video.videoHeight ? this.video.videoWidth / this.video.videoHeight : 16 / 9 }

  async start(deviceId) {
    this.stop()
    await loadLandmarker()
    this.stream = await navigator.mediaDevices.getUserMedia({
      // the model works on a small image anyway; 640x360 keeps detection cheap
      video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 30 } },
      audio: false
    })
    this.video.srcObject = this.stream
    // an unplugged camera or an iPhone that drops out ends the track
    for (const t of this.stream.getVideoTracks()) t.onended = () => { this.stop(); this.onEnded() }
    await this.video.play()
    this.running = true
    const loop = () => {
      if (!this.running) return
      try { this._detect() } catch (e) { this.hands = []; console.log('HANDS detection error: ' + e.message) }
      this.video.requestVideoFrameCallback ? this.video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop)
    }
    loop()
  }

  stop() {
    this.running = false
    if (this.stream) for (const t of this.stream.getTracks()) t.stop()
    this.stream = null
    this.hands = []
  }

  _detect() {
    if (!landmarker || !this.active || this.video.readyState < 2) return
    const ts = performance.now()
    if (ts - this._lastTs < 66) return          // ~15 detections a second is plenty
    this._lastTs = ts
    const res = landmarker.detectForVideo(this.video, ts)
    this.hands = (res.landmarks || []).map((points, i) => {
      // MediaPipe labels hands as seen in a mirror; a camera looking down at the
      // keys is not mirrored, so swap unless the view is mirrored.
      const label = res.handedness?.[i]?.[0]?.categoryName === 'Left' ? 'left' : 'right'
      const side = this.mirror ? label : (label === 'left' ? 'right' : 'left')
      return { side, points }
    })
    if (this.hands.length) this.lastSeen = ts
    this.onFrame(this.hands)
  }

  // Where along the key row (0 = left end, 1 = right end) a point is, and how far
  // off the row it is (in row lengths), from the calibration line.
  // Measured in a space where x and y have the same scale (image coords are 0..1 on
  // both axes, but a 16:9 picture is wider than tall).
  project(p, k = this.aspect) {
    if (!this.calib) return null
    const { a, b } = this.calib
    const dx = (b.x - a.x) * k, dy = b.y - a.y
    const px = (p.x - a.x) * k, py = p.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = (px * dx + py * dy) / len2
    const off = (px * dy - py * dx) / len2
    return { t, off }
  }

  // Fingertips that are over the key row: [{ side, finger 1..5, t }]. `maxOff` is in
  // key-row lengths: 0.12 is about a white key's length on a 24-key row.
  fingertipsOverKeys(maxOff = 0.12) {
    const out = []
    if (performance.now() - this.lastSeen > 300) return out   // hands gone, or camera stalled
    for (const h of this.hands) {
      TIPS.forEach((idx, f) => {
        const q = this.project(h.points[idx])
        if (q && q.t >= -0.02 && q.t <= 1.02 && Math.abs(q.off) <= maxOff) out.push({ side: h.side, finger: f + 1, t: Math.max(0, Math.min(1, q.t)) })
      })
    }
    return out
  }

  // Grab the current frame as grey levels, downscaled (for calibration).
  grabLuma(w = 320) {
    const v = this.video
    const h = Math.round((w * v.videoHeight) / v.videoWidth) || 180
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(v, 0, 0, w, h)
    const d = g.getImageData(0, 0, w, h).data
    const y = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) y[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
    return { y, w, h }
  }

  // Automatic calibration. lightKey(i) lights only key i on the real keyboard
  // (lightKey(null) darkens it). Each end is lit on its own, so the first spot is
  // key 0 whatever the camera angle, tilt or mirroring.
  async autoCalibrate(lightKey) {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms))
    lightKey(null); await wait(450)
    const dark = this.grabLuma()
    const spotFor = async (i) => {
      lightKey(i); await wait(450)
      const lit = this.grabLuma()
      const { w, h } = lit
      let max = 0
      const diff = new Float32Array(w * h)
      for (let j = 0; j < diff.length; j++) { diff[j] = Math.max(0, lit.y[j] - dark.y[j]); if (diff[j] > max) max = diff[j] }
      if (max < 25) return null
      let sx = 0, sy = 0, n = 0
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (diff[yy * w + xx] >= max * 0.5) { sx += xx; sy += yy; n++ }
      return n >= 2 ? { x: sx / n / w, y: sy / n / h } : null
    }
    const a = await spotFor(0)
    const b = await spotFor(23)
    lightKey(null)
    if (!a || !b) return false
    // the two spots must be clearly apart (not one reflection)
    if (Math.hypot((b.x - a.x) * this.aspect, b.y - a.y) < 0.1) return false
    this.calib = { a, b }
    return true
  }
}

// Self-test without a camera: load the model and run it on a blank picture.
export async function selfTestLandmarker() {
  const lm = await loadLandmarker()
  const c = document.createElement('canvas')
  c.width = 320; c.height = 180
  c.getContext('2d').fillRect(0, 0, 320, 180)
  const res = lm.detectForVideo(c, performance.now())
  return (res.landmarks || []).length
}
