import { useState, useRef, useEffect } from "react";
import { Card, Button, Alert, Spinner, Form } from "react-bootstrap";
import { tinykeys, defaultKeybindingsHandlerIgnore } from "tinykeys";
import { useAudioTranslation } from "../context/AudioTranslationContext";
import { useAuth } from "../context/AuthContext";
import AudioVisualizer from "./AudioVisualizer";

function AudioRecorder() {
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const intervalRef = useRef(null);
  const startingRef = useRef(false); // true while waiting for the mic permission prompt
  const toggleRef = useRef(null);

  const {
    isRecording,
    isTranslating,
    error,
    addTranslation,
    setRecording,
    clearError,
    setError,
  } = useAudioTranslation();

  const { isLoggedIn, storeOnRecord, setStoreOnRecord } = useAuth();

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [stream]);

  const startRecording = async () => {
    // A second press while the permission prompt is open must not open a second stream
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      clearError();
      // Browsers only expose the mic on secure origins (https or localhost). Over plain
      // http on a LAN address navigator.mediaDevices is undefined.
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(
          new Error(
            window.isSecureContext
              ? "This browser does not support audio recording."
              : "Recording needs a secure connection. Open this page over https:// (or on localhost). With the dev server, run `npm run dev:lan` and use the https address."
          ),
          { name: "InsecureContextError" }
        );
      }
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      setStream(audioStream);

      const recorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm;codecs=opus" });

        // Pass the actual recording duration
        await addTranslation(audioBlob, recordingTime);
      };

      setMediaRecorder(recorder);
      recorder.start(1000); // Collect data every second
      setRecording(true);
      setRecordingTime(0);
      setAnnouncement("Recording started");

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      setRecording(false);
      setError(
        error.name === "InsecureContextError"
          ? error.message
          : error.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser's site settings and try again."
          : error.name === "NotFoundError"
            ? "No microphone found."
            : "Could not start recording: " + error.message
      );
    } finally {
      startingRef.current = false;
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setRecording(false);
      setAnnouncement("Recording stopped");

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const toggleRecording = () => {
    if (isTranslating) return; // same rule as the disabled button
    if (isRecording) stopRecording();
    else startRecording();
  };

  // Always point at the latest render's handler so the keydown listener never goes stale
  useEffect(() => {
    toggleRef.current = toggleRecording;
  });

  // Keyboard shortcut: R starts/stops recording. (Space is the leader key for
  // the history actions, see TranslationHistory.)
  useEffect(() => {
    const toggle = (e) => {
      e.preventDefault();
      toggleRef.current?.();
    };

    // tinykeys already skips key-repeat, IME composition, typing in form
    // fields, and any press with Ctrl/Cmd/Alt/Shift held.
    return tinykeys(
      window,
      {
        r: toggle,
      },
      {
        ignore: (e) =>
          defaultKeybindingsHandlerIgnore(e) ||
          e.defaultPrevented ||
          // Leave keys alone while a modal (e.g. export) is open
          document.body.classList.contains("modal-open"),
      }
    );
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

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
            className={`record-button${isRecording ? " recording" : ""}`}
            aria-keyshortcuts="R"
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
          {/* Only shown on devices with a real pointer/keyboard (see App.css) */}
          <div className="kbd-hint text-muted small mt-2">
            Press <kbd>R</kbd> to {isRecording ? "stop" : "start"}
          </div>
          {isLoggedIn && (
            <Form.Check
              type="switch"
              id="store-on-record"
              className="d-inline-block mt-3 text-start"
              label="Store transcript on my account"
              checked={storeOnRecord}
              onChange={(e) => setStoreOnRecord(e.target.checked)}
              disabled={isRecording || isTranslating}
            />
          )}
          {isLoggedIn && storeOnRecord && (
            <div className="text-muted small">
              Stored on the API only: the audio is not kept locally.
            </div>
          )}
        </div>

        <div className="visually-hidden" role="status" aria-live="polite">
          {announcement}
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
  );
}

export default AudioRecorder;
