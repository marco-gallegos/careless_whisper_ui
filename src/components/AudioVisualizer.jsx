import { useEffect, useRef, useState } from 'react'

function AudioVisualizer({ stream, isRecording }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const analyserRef = useRef(null)
  const [audioData, setAudioData] = useState(new Uint8Array(0))

  useEffect(() => {
    if (stream && isRecording) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      
      analyser.fftSize = 256
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      source.connect(analyser)
      analyserRef.current = analyser
      
      const updateAudioData = () => {
        analyser.getByteFrequencyData(dataArray)
        setAudioData(new Uint8Array(dataArray))
        animationRef.current = requestAnimationFrame(updateAudioData)
      }
      
      updateAudioData()
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
        audioContext.close()
      }
    } else {
      setAudioData(new Uint8Array(0))
    }
  }, [stream, isRecording])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    if (audioData.length === 0) {
      // Draw static bars when not recording
      ctx.fillStyle = '#e9ecef'
      for (let i = 0; i < 32; i++) {
        const barWidth = width / 32
        const barHeight = 10
        const x = i * barWidth
        const y = height - barHeight
        ctx.fillRect(x, y, barWidth - 2, barHeight)
      }
      return
    }

    // Draw audio visualization
    const barWidth = width / audioData.length
    
    for (let i = 0; i < audioData.length; i++) {
      const barHeight = (audioData[i] / 255) * height
      const x = i * barWidth
      const y = height - barHeight
      
      // Create gradient
      const gradient = ctx.createLinearGradient(0, height, 0, 0)
      gradient.addColorStop(0, '#007bff')
      gradient.addColorStop(1, '#0056b3')
      
      ctx.fillStyle = gradient
      ctx.fillRect(x, y, barWidth - 1, barHeight)
    }
  }, [audioData])

  return (
    <div className="audio-visualizer mb-3">
      <canvas
        ref={canvasRef}
        width={400}
        height={60}
        style={{ width: '100%', height: '60px' }}
      />
    </div>
  )
}

export default AudioVisualizer