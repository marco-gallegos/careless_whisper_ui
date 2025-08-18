import { useState, useRef, useEffect } from 'react'
import { Card, Button, Alert, Spinner } from 'react-bootstrap'
import { useAudioTranslation } from '../context/AudioTranslationContext'
import AudioVisualizer from './AudioVisualizer'

function AudioRecorder() {
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [audioChunks, setAudioChunks] = useState([])
  const [recordingTime, setRecordingTime] = useState(0)
  const [stream, setStream] = useState(null)
  const intervalRef = useRef(null)
  
  const { 
    isRecording, 
    isTranslating, 
    error, 
    addTranslation, 
    setRecording, 
    clearError 
  } = useAudioTranslation()

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [stream])

  const startRecording = async () => {
    try {
      clearError()
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      })
      
      setStream(audioStream)
      
      const recorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      const chunks = []
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' })
        
        // Pass the actual recording duration
        await addTranslation(audioBlob, recordingTime)
        setAudioChunks([])
      }
      
      setMediaRecorder(recorder)
      setAudioChunks(chunks)
      recorder.start(1000) // Collect data every second
      setRecording(true)
      setRecordingTime(0)
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
    } catch (error) {
      console.error('Error starting recording:', error)
      setRecording(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      setRecording(false)
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
        setStream(null)
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card>
      <Card.Header>
        <h5 className="mb-0">Audio Recorder</h5>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={clearError}>
            {error}
          </Alert>
        )}
        
        <div className="text-center mb-3">
          <Button
            variant={isRecording ? "danger" : "primary"}
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranslating}
            className={isRecording ? "recording" : ""}
          >
            {isRecording ? (
              <>
                <i className="bi bi-stop-fill me-2"></i>
                Stop Recording
              </>
            ) : (
              <>
                <i className="bi bi-mic-fill me-2"></i>
                Start Recording
              </>
            )}
          </Button>
        </div>
        
        {isRecording && (
          <div className="text-center mb-3">
            <h4 className="text-primary">{formatTime(recordingTime)}</h4>
          </div>
        )}
        
        <AudioVisualizer stream={stream} isRecording={isRecording} />
        
        {isTranslating && (
          <div className="text-center mt-3">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Translating audio to text...</p>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

export default AudioRecorder