import { useState, useRef, useEffect, useCallback } from "react";
import { Card, Button, ListGroup, Badge, Alert } from "react-bootstrap";
import { useAudioTranslation } from "../context/AudioTranslationContext";

function TranslationHistory() {
  const {
    translations,
    copyToClipboard,
    deleteTranslation,
    reprocessTranslation,
    isTranslating,
  } = useAudioTranslation();
  const [copiedId, setCopiedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const handleCopy = async (text, id) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Records saved before status existed always had text, so they count as done
  const getStatus = (t) => t.status || "done";

  const truncateText = (text = "", maxLength = 100) => {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  // Only one recording plays at a time. The ref (not state) is the source of
  // truth so rapid double-clicks can't start overlapping audio.
  const stopAudio = useCallback(() => {
    const current = audioRef.current;
    audioRef.current = null;
    if (current) current.audio.pause();
    setPlayingId(null);
  }, []);

  useEffect(() => stopAudio, [stopAudio]); // stop on unmount

  const playAudio = async (translation) => {
    if (!translation.audioUrl) return;

    // Clicking the playing item again stops it
    if (audioRef.current?.id === translation.id) {
      stopAudio();
      return;
    }

    stopAudio();
    const audio = new Audio(translation.audioUrl);
    const entry = { id: translation.id, audio };
    audioRef.current = entry;
    setPlayingId(translation.id);

    const finish = () => {
      if (audioRef.current === entry) {
        audioRef.current = null;
        setPlayingId(null);
      }
    };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);

    try {
      await audio.play();
    } catch (error) {
      // AbortError just means we stopped it before it started
      if (error.name !== "AbortError") {
        console.error("Error playing audio:", error);
      }
      finish();
    }
  };

  if (translations.length === 0) {
    return (
      <Card>
        <Card.Header>
          <h5 className="mb-0">Translation History</h5>
        </Card.Header>
        <Card.Body>
          <Alert variant="info" className="text-center">
            No translations yet. Start recording to see your translation history
            here.
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Translation History</h5>
        <Badge bg="secondary">{translations.length} translations</Badge>
      </Card.Header>
      <Card.Body style={{ maxHeight: "400px", overflowY: "auto" }}>
        <ListGroup variant="flush">
          {translations.map((translation) => (
            <ListGroup.Item
              key={translation.id}
              className="translation-card border rounded mb-2 p-3"
            >
              <div className="d-flex flex-column flex-md-row justify-content-md-between align-items-md-start">
                <div className="flex-grow-1">
                  {getStatus(translation) === "done" ? (
                    <p className="mb-2">
                      {truncateText(translation.text) || (
                        <em className="text-muted">(no speech detected)</em>
                      )}
                    </p>
                  ) : (
                    <p className="mb-2">
                      <Badge
                        bg={
                          getStatus(translation) === "failed"
                            ? "warning"
                            : "secondary"
                        }
                        text={
                          getStatus(translation) === "failed" ? "dark" : undefined
                        }
                        className="me-2"
                      >
                        {getStatus(translation) === "failed"
                          ? "Not transcribed"
                          : "Transcribing..."}
                      </Badge>
                      {translation.error && (
                        <small className="text-muted">{translation.error}</small>
                      )}
                    </p>
                  )}
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-muted">
                      {formatDate(translation.timestamp)}
                    </small>
                    {translation.duration > 0 && (
                      <Badge bg="light" text="dark" className="ms-2">
                        <i className="bi bi-clock me-1"></i>
                        {formatDuration(translation.duration)}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="history-actions d-flex flex-wrap gap-2 mt-3 mt-md-0 ms-md-3">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleCopy(translation.text, translation.id)}
                    className="history-action flex-fill flex-md-grow-0"
                    disabled={!translation.text}
                  >
                    {copiedId === translation.id ? (
                      <>
                        <i className="bi bi-check-lg me-1"></i>
                        Copied!
                      </>
                    ) : (
                      <>
                        <i className="bi bi-clipboard me-1"></i>
                        Copy
                      </>
                    )}
                  </Button>
                  {translation.audioUrl && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => playAudio(translation)}
                      className="history-action flex-fill flex-md-grow-0"
                      title={playingId === translation.id ? "Stop audio" : "Play audio"}
                      aria-label={
                        playingId === translation.id ? "Stop audio" : "Play audio"
                      }
                      aria-pressed={playingId === translation.id}
                    >
                      {playingId === translation.id ? (
                        <>
                          <i className="bi bi-stop-fill me-1"></i>
                          Stop
                        </>
                      ) : (
                        <>
                          <i className="bi bi-play-fill me-1"></i>
                          Play
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline-info"
                    size="sm"
                    onClick={() => reprocessTranslation(translation.id)}
                    className="history-action flex-fill flex-md-grow-0"
                    disabled={isTranslating}
                    title="Run transcription again on the saved audio"
                  >
                    {isTranslating ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-1"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-arrow-clockwise me-1"></i>
                        {getStatus(translation) === "done"
                          ? "Retranscribe"
                          : "Transcribe"}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => deleteTranslation(translation.id)}
                    className="history-action flex-fill flex-md-grow-0"
                    title="Delete recording"
                    aria-label="Delete recording"
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                </div>
              </div>

              {(translation.text || "").length > 100 && (
                <details className="mt-2">
                  <summary
                    className="text-primary"
                    style={{ cursor: "pointer" }}
                  >
                    Show full text
                  </summary>
                  <p className="mt-2 mb-0">{translation.text}</p>
                </details>
              )}
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
    </Card>
  );
}

export default TranslationHistory;
