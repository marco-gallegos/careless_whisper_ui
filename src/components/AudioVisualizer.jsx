import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

const BAR_COUNT = 41 // odd, so there is a centre bar
const MIN_BAR = 4 // px, keeps idle/quiet bars visible
const GAIN = 1.8 // voice sits low in the spectrum; boost it so speech fills the panel
const IDLE_COLOR = '#4b5563'

function AudioVisualizer({ stream, isRecording }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Match the backing store to the CSS size so bars are crisp on retina/mobile
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // levels: array of BAR_COUNT values in 0..1, or null for the idle state
    const draw = (levels) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      const slot = w / BAR_COUNT
      const barW = Math.max(2, slot * 0.6)
      const maxH = h - 16

      let fill = IDLE_COLOR
      if (levels) {
        fill = ctx.createLinearGradient(0, 0, 0, h)
        fill.addColorStop(0, '#60a5fa')
        fill.addColorStop(0.5, '#ffffff')
        fill.addColorStop(1, '#60a5fa')
      }
      ctx.fillStyle = fill

      for (let i = 0; i < BAR_COUNT; i++) {
        const level = levels ? levels[i] : 0
        const barH = Math.max(MIN_BAR, level * maxH)
        const x = i * slot + (slot - barW) / 2
        const y = (h - barH) / 2
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, barW / 2)
        else ctx.rect(x, y, barW, barH)
        ctx.fill()
      }
    }

    fit()
    const observer = new ResizeObserver(() => {
      fit()
      if (!stream || !isRecording) draw(null)
    })
    observer.observe(canvas)

    if (!stream || !isRecording) {
      draw(null)
      return () => observer.disconnect()
    }

    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    audioContext.resume?.() // Safari/iOS may start suspended
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.75
    audioContext.createMediaStreamSource(stream).connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    const levels = new Array(BAR_COUNT)
    const centre = (BAR_COUNT - 1) / 2
    let frame = null

    // Draw straight to the canvas each frame; no React state, so no re-renders
    const tick = () => {
      analyser.getByteFrequencyData(data)
      for (let i = 0; i < BAR_COUNT; i++) {
        // Lowest frequencies (most voice energy) in the middle, mirrored outwards
        const bin = Math.round((Math.abs(i - centre) / centre) * (data.length / 2 - 1))
        levels[i] = Math.min(1, (data[bin] / 255) * GAIN)
      }
      draw(levels)
      frame = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      audioContext.close()
    }
  }, [stream, isRecording])

  return (
    <div className={`audio-visualizer mb-3${isRecording ? ' is-active' : ''}`}>
      <canvas ref={canvasRef} className="audio-visualizer__canvas" />
      <span className="audio-visualizer__label">
        {isRecording ? (
          <>
            <span className="rec-dot" /> Listening
          </>
        ) : (
          'Ready'
        )}
      </span>
    </div>
  )
}

AudioVisualizer.propTypes = {
  stream: PropTypes.object,
  isRecording: PropTypes.bool,
}

export default AudioVisualizer