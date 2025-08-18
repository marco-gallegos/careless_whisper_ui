import Dexie from 'dexie'

class AudioTranslationDB extends Dexie {
  constructor() {
    super('AudioTranslationDB')
    
    this.version(1).stores({
      translations: '++id, timestamp, text, audioUrl, duration, audioData, mimeType'
    })
  }

  async add(translation) {
    // Store the audio blob as ArrayBuffer for persistence
    if (translation.audioBlob) {
      translation.audioData = await translation.audioBlob.arrayBuffer()
      translation.mimeType = translation.audioBlob.type
      // Remove the blob reference since we're storing the data
      delete translation.audioBlob
    }
    return await this.translations.add(translation)
  }

  async getAll() {
    const translations = await this.translations.orderBy('timestamp').reverse().toArray()
    
    // Convert stored audio data back to blob URLs for playback
    return translations.map(translation => {
      if (translation.audioData && translation.mimeType) {
        const blob = new Blob([translation.audioData], { type: translation.mimeType })
        translation.audioUrl = URL.createObjectURL(blob)
        translation.audioBlob = blob
      }
      return translation
    })
  }

  async getById(id) {
    const translation = await this.translations.get(id)
    if (translation && translation.audioData && translation.mimeType) {
      const blob = new Blob([translation.audioData], { type: translation.mimeType })
      translation.audioUrl = URL.createObjectURL(blob)
      translation.audioBlob = blob
    }
    return translation
  }

  async delete(id) {
    // Clean up any blob URLs before deleting
    const translation = await this.translations.get(id)
    if (translation && translation.audioUrl) {
      URL.revokeObjectURL(translation.audioUrl)
    }
    return await this.translations.delete(id)
  }

  async clear() {
    // Clean up all blob URLs before clearing
    const translations = await this.translations.toArray()
    translations.forEach(t => {
      if (t.audioUrl) {
        URL.revokeObjectURL(t.audioUrl)
      }
    })
    return await this.translations.clear()
  }

  async exportToJSON() {
    const translations = await this.getAll()
    return JSON.stringify(translations, null, 2)
  }

  async exportToSQLite() {
    // This would require a backend service to handle SQLite export
    // For now, we'll return the data in a format suitable for SQLite
    const translations = await this.getAll()
    
    let sql = `CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY,
      timestamp TEXT,
      text TEXT,
      audio_url TEXT,
      duration REAL
    );\n\n`
    
    translations.forEach(t => {
      sql += `INSERT INTO translations (id, timestamp, text, audio_url, duration) VALUES (
        ${t.id}, 
        '${t.timestamp}', 
        '${t.text.replace(/'/g, "''")}', 
        '${t.audioUrl || ''}', 
        ${t.duration || 0}
      );\n`
    })
    
    return sql
  }
}

export const audioTranslationDB = new AudioTranslationDB()