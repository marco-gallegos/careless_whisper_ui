import { useState } from 'react'
import { Card, Button, Form, Alert, Spinner } from 'react-bootstrap'
import { audioTranslationDB } from '../services/database'
import { useAudioTranslation } from '../context/AudioTranslationContext'

function ExportOptions() {
  const [exportFormat, setExportFormat] = useState('json')
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [mongoConfig, setMongoConfig] = useState({
    connectionString: 'mongodb://localhost:27017',
    database: 'audio_translations',
    collection: 'translations'
  })
  
  const { translations } = useAudioTranslation()

  const downloadFile = (content, filename, contentType) => {
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportToJSON = async () => {
    try {
      setIsExporting(true)
      const jsonData = await audioTranslationDB.exportToJSON()
      const timestamp = new Date().toISOString().split('T')[0]
      downloadFile(jsonData, `translations_${timestamp}.json`, 'application/json')
      setExportMessage('Successfully exported to JSON file!')
    } catch (error) {
      setExportMessage('Failed to export to JSON: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  const exportToSQLite = async () => {
    try {
      setIsExporting(true)
      const sqlData = await audioTranslationDB.exportToSQLite()
      const timestamp = new Date().toISOString().split('T')[0]
      downloadFile(sqlData, `translations_${timestamp}.sql`, 'text/sql')
      setExportMessage('Successfully exported SQLite script!')
    } catch (error) {
      setExportMessage('Failed to export to SQLite: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  const exportToMongoDB = async () => {
    try {
      setIsExporting(true)
      
      // This would require a backend service to handle MongoDB connection
      // For now, we'll create a MongoDB import script
      const translations = await audioTranslationDB.getAll()
      const mongoScript = `// MongoDB import script
// Run this in MongoDB shell or use mongoimport

use ${mongoConfig.database};

db.${mongoConfig.collection}.insertMany(${JSON.stringify(translations, null, 2)});`

      const timestamp = new Date().toISOString().split('T')[0]
      downloadFile(mongoScript, `mongodb_import_${timestamp}.js`, 'application/javascript')
      setExportMessage('Successfully created MongoDB import script!')
    } catch (error) {
      setExportMessage('Failed to create MongoDB script: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExport = () => {
    setExportMessage('')
    
    if (translations.length === 0) {
      setExportMessage('No translations to export!')
      return
    }

    switch (exportFormat) {
      case 'json':
        exportToJSON()
        break
      case 'sqlite':
        exportToSQLite()
        break
      case 'mongodb':
        exportToMongoDB()
        break
      default:
        setExportMessage('Invalid export format selected')
    }
  }

  return (
    <Card>
      <Card.Header>
        <h5 className="mb-0">Export Options</h5>
      </Card.Header>
      <Card.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Export Format</Form.Label>
            <Form.Select 
              value={exportFormat} 
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="json">JSON File</option>
              <option value="sqlite">SQLite Script</option>
              <option value="mongodb">MongoDB Script</option>
            </Form.Select>
          </Form.Group>

          {exportFormat === 'mongodb' && (
            <div className="mb-3">
              <Form.Group className="mb-2">
                <Form.Label>MongoDB Connection String</Form.Label>
                <Form.Control
                  type="text"
                  value={mongoConfig.connectionString}
                  onChange={(e) => setMongoConfig({
                    ...mongoConfig,
                    connectionString: e.target.value
                  })}
                  placeholder="mongodb://localhost:27017"
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Database Name</Form.Label>
                <Form.Control
                  type="text"
                  value={mongoConfig.database}
                  onChange={(e) => setMongoConfig({
                    ...mongoConfig,
                    database: e.target.value
                  })}
                  placeholder="audio_translations"
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Collection Name</Form.Label>
                <Form.Control
                  type="text"
                  value={mongoConfig.collection}
                  onChange={(e) => setMongoConfig({
                    ...mongoConfig,
                    collection: e.target.value
                  })}
                  placeholder="translations"
                />
              </Form.Group>
            </div>
          )}

          <Button 
            variant="success" 
            onClick={handleExport}
            disabled={isExporting || translations.length === 0}
            className="w-100"
          >
            {isExporting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Exporting...
              </>
            ) : (
              <>
                <i className="bi bi-download me-2"></i>
                Export Data ({translations.length} translations)
              </>
            )}
          </Button>
        </Form>

        {exportMessage && (
          <Alert 
            variant={exportMessage.includes('Successfully') ? 'success' : 'danger'} 
            className="mt-3"
            dismissible
            onClose={() => setExportMessage('')}
          >
            {exportMessage}
          </Alert>
        )}
      </Card.Body>
    </Card>
  )
}

export default ExportOptions