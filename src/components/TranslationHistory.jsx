import { useState, useRef, useEffect, useCallback } from "react";
import { Card, Button, ListGroup, Badge, Alert, Modal } from "react-bootstrap";
import { tinykeys, defaultKeybindingsHandlerIgnore } from "tinykeys";
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
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const audioRef = useRef(null);
  const shortcutsRef = useRef({});

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

  // Newest recording first, so the "latest" one is index 0
  const latest = translations[0];
  const pendingItem = translations.find((t) => t.id === pendingDeleteId);

  // Deleting always goes through the confirmation modal
  const requestDelete = (id) => setPendingDeleteId(id);
  const cancelDelete = () => setPendingDeleteId(null);
  const confirmDelete = async () => {
    if (pendingDeleteId === null) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    if (audioRef.current?.id === id) stopAudio();
    await deleteTranslation(id);
  };

  // Handlers read the current render's state through a ref so the key listeners
  // below are registered once and never go stale.
  useEffect(() => {
    shortcutsRef.current = {
      copy: () => latest?.text && handleCopy(latest.text, latest.id),
      play: () => latest && playAudio(latest),
      remove: () => latest && requestDelete(latest.id),
      confirmDelete,
      cancelDelete,
    };
  });

  // Space is the leader key: "Space c" copy, "Space p" play/stop, "Space d" delete
  // (all act on the latest recording). tinykeys sequences work whether Space is
  // released or still held when the second key is pressed (1s window).
  useEffect(() => {
    const ignore = (e) =>
      defaultKeybindingsHandlerIgnore(e) ||
      e.defaultPrevented ||
      document.body.classList.contains("modal-open");
    const run = (name) => (e) => {
      e.preventDefault();
      shortcutsRef.current[name]?.();
    };

    const unsubscribe = tinykeys(
      window,
      {
        "Space c": run("copy"),
        "Space p": run("play"),
        "Space d": run("remove"),
      },
      { ignore }
    );

    // The leader press itself must not scroll the page (but leave Space alone on
    // focused buttons/links so keyboard activation still works)
    const onSpace = (e) => {
      if (e.code !== "Space" || ignore(e)) return;
      if (["BUTTON", "A", "SUMMARY"].includes(e.target.tagName)) return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onSpace);

    return () => {
      unsubscribe();
      window.removeEventListener("keydown", onSpace);
    };
  }, []);

  // While the confirmation is open: Y confirms, N cancels (Esc also cancels via the modal)
  const isConfirming = pendingDeleteId !== null;
  useEffect(() => {
    if (!isConfirming) return;
    return tinykeys(
      window,
      {
        y: (e) => {
          e.preventDefault();
          shortcutsRef.current.confirmDelete?.();
        },
        n: (e) => {
          e.preventDefault();
          shortcutsRef.current.cancelDelete?.();
        },
      },
      { ignore: defaultKeybindingsHandlerIgnore }
    );
  }, [isConfirming]);

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
    <>
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Translation History</h5>
        <Badge bg="secondary">{translations.length} translations</Badge>
      </Card.Header>
      <Card.Body style={{ maxHeight: "400px", overflowY: "auto" }}>
        {/* Only shown on devices with a real pointer/keyboard (see App.css) */}
        <div className="kbd-hint text-muted small mb-2">
          Latest recording: <kbd>Space</kbd> then <kbd>C</kbd> copy,{" "}
          <kbd>P</kbd> play/stop, <kbd>D</kbd> delete
        </div>
        <ListGroup variant="flush">
          {translations.map((translation) => (
            <ListGroup.Item
              key={translation.id}
              className={`translation-card border rounded mb-2 p-3${
                translation.id === latest.id ? " border-primary" : ""
              }`}
            >
              <div className="d-flex flex-column flex-xl-row justify-content-xl-between align-items-xl-start">
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
                      {translation.id === latest.id && (
                        <Badge bg="primary" className="me-2">
                          Latest
                        </Badge>
                      )}
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
                <div className="history-actions d-flex flex-wrap gap-2 mt-3 mt-xl-0 ms-xl-3">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleCopy(translation.text, translation.id)}
                    className="history-action flex-fill flex-xl-grow-0"
                    disabled={!translation.text}
                    title={
                      translation.id === latest.id ? "Copy (Space, then C)" : undefined
                    }
                    aria-keyshortcuts={
                      translation.id === latest.id ? "Space C" : undefined
                    }
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
                      className="history-action flex-fill flex-xl-grow-0"
                      title={`${
                        playingId === translation.id ? "Stop audio" : "Play audio"
                      }${translation.id === latest.id ? " (Space, then P)" : ""}`}
                      aria-label={
                        playingId === translation.id ? "Stop audio" : "Play audio"
                      }
                      aria-pressed={playingId === translation.id}
                      aria-keyshortcuts={
                        translation.id === latest.id ? "Space P" : undefined
                      }
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
                    className="history-action flex-fill flex-xl-grow-0"
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
                    onClick={() => requestDelete(translation.id)}
                    className="history-action flex-fill flex-xl-grow-0"
                    title={
                      translation.id === latest.id
                        ? "Delete recording (Space, then D)"
                        : "Delete recording"
                    }
                    aria-label="Delete recording"
                    aria-keyshortcuts={
                      translation.id === latest.id ? "Space D" : undefined
                    }
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

    <Modal show={isConfirming} onHide={cancelDelete} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">Delete this recording?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {pendingItem && (
          <p className="mb-2">
            <small className="text-muted d-block">
              {formatDate(pendingItem.timestamp)}
              {pendingItem.duration > 0 &&
                ` · ${formatDuration(pendingItem.duration)}`}
            </small>
            {truncateText(pendingItem.text, 140) || (
              <em className="text-muted">(no transcript)</em>
            )}
          </p>
        )}
        <p className="mb-0">
          This removes the saved audio and its transcript. This cannot be undone.
        </p>
      </Modal.Body>
      <Modal.Footer>
        {/* "No" is the default focus so a stray Enter/Space never deletes */}
        <Button variant="outline-secondary" onClick={cancelDelete} autoFocus>
          No <kbd className="kbd-inline ms-1">N</kbd>
        </Button>
        <Button variant="danger" onClick={confirmDelete}>
          Yes, delete <kbd className="kbd-inline ms-1">Y</kbd>
        </Button>
      </Modal.Footer>
    </Modal>
    </>
  );
}

export default TranslationHistory;
