import { createContext, useContext, useReducer, useEffect } from 'react'
import { audioTranslationDB } from '../services/database'
import { translateAudio } from '../services/translationService'

const AudioTranslationContext = createContext()

const initialState = {
  translations: [],
  isRecording: false,
  isTranslating: false,
  lastTranslation: null,
  error: null
}

function audioTranslationReducer(state, action) {
  switch (action.type) {
    case 'SET_TRANSLATIONS':
      return { ...state, translations: action.payload }
    case 'ADD_TRANSLATION':
      return { 
        ...state, 
        translations: [action.payload, ...state.translations],
        lastTranslation: action.payload
      }
    case 'SET_RECORDING':
      return { ...state, isRecording: action.payload }
    case 'SET_TRANSLATING':
      return { ...state, isTranslating: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    default:
      return state
  }
}

export function AudioTranslationProvider({ children }) {
  const [state, dispatch] = useReducer(audioTranslationReducer, initialState)

  useEffect(() => {
    loadTranslations()
    
    // Cleanup function to revoke blob URLs when component unmounts
    return () => {
      state.translations.forEach(translation => {
        if (translation.audioUrl) {
          URL.revokeObjectURL(translation.audioUrl)
        }
      })
    }
  }, [])

  const loadTranslations = async () => {
    try {
      const translations = await audioTranslationDB.getAll()
      dispatch({ type: 'SET_TRANSLATIONS', payload: translations })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load translations' })
    }
  }

  const addTranslation = async (audioBlob, recordingDuration = 0) => {
    try {
      dispatch({ type: 'SET_TRANSLATING', payload: true })
      dispatch({ type: 'CLEAR_ERROR' })

      const translation = await translateAudio(audioBlob)
      
      // Calculate audio duration if not provided
      const duration = recordingDuration || await getAudioDuration(audioBlob)
      
      const translationRecord = {
        id: Date.now(),
        audioBlob, // This will be converted to ArrayBuffer in the database
        text: translation,
        timestamp: new Date().toISOString(),
        duration: duration
      }

      // Add to database (this will handle the blob storage)
      await audioTranslationDB.add(translationRecord)
      
      // Reload translations to get the updated list with proper blob URLs
      await loadTranslations()
      
      // Auto-copy to clipboard
      await copyToClipboard(translation)
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Translation failed: ' + error.message })
    } finally {
      dispatch({ type: 'SET_TRANSLATING', payload: false })
    }
  }

  const getAudioDuration = async (audioBlob) => {
    return new Promise((resolve) => {
      const audio = new Audio()
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration || 0)
      })
      audio.addEventListener('error', () => {
        resolve(0)
      })
      audio.src = URL.createObjectURL(audioBlob)
    })
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      return false
    }
  }

  const deleteTranslation = async (id) => {
    try {
      await audioTranslationDB.delete(id)
      const updatedTranslations = state.translations.filter(t => t.id !== id)
      dispatch({ type: 'SET_TRANSLATIONS', payload: updatedTranslations })
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete translation' })
    }
  }

  const value = {
    ...state,
    addTranslation,
    copyToClipboard,
    deleteTranslation,
    setRecording: (recording) => dispatch({ type: 'SET_RECORDING', payload: recording }),
    clearError: () => dispatch({ type: 'CLEAR_ERROR' })
  }

  return (
    <AudioTranslationContext.Provider value={value}>
      {children}
    </AudioTranslationContext.Provider>
  )
}

export function useAudioTranslation() {
  const context = useContext(AudioTranslationContext)
  if (!context) {
    throw new Error('useAudioTranslation must be used within AudioTranslationProvider')
  }
  return context
}