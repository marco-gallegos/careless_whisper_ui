import { useState } from 'react'
import { Card, Button, ListGroup, Badge, Alert } from 'react-bootstrap'
import { useAudioTranslation } from '../context/AudioTranslationContext'

function TranslationHistory() {
  const { translations, copyToClipboard, deleteTranslation } = useAudioTranslation()
  const [copiedId, setCopiedId] = useState(null)

  const handleCopy = async (text, id) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return ''
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const truncateText = (text, maxLength = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  const playAudio = (translation) => {
    if (translation.audioUrl) {
      const audio = new Audio(translation.audioUrl)
      audio.play().catch(error => {
        console.error('Error playing audio:', error)
      })
    }
  }

  if (translations.length === 0) {
    return (
      <Card>
        <Card.Header>
          <h5 className="mb-0">Translation History</h5>
        </Card.Header>
        <Card.Body>
          <Alert variant="info" className="text-center">
            No translations yet. Start recording to see your translation history here.
          </Alert>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Translation History</h5>
        <Badge bg="secondary">{translations.length} translations</Badge>
      </Card.Header>
      <Card.Body style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <ListGroup variant="flush">
          {translations.map((translation) => (
            <ListGroup.Item 
              key={translation.id} 
              className="translation-card border rounded mb-2 p-3"
            >
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <p className="mb-2">{truncateText(translation.text)}</p>
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
                <div className="ms-3">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleCopy(translation.text, translation.id)}
                    className="me-2"
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
                      className="me-2"
                      title="Play audio"
                    >
                      <i className="bi bi-play-fill"></i>
                    </Button>
                  )}
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => deleteTranslation(translation.id)}
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                </div>
              </div>
              
              {translation.text.length > 100 && (
                <details className="mt-2">
                  <summary className="text-primary" style={{ cursor: 'pointer' }}>
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
  )
}

export default TranslationHistory