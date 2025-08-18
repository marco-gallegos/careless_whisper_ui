import { useState, useEffect } from 'react'

export function useAudioPermissions() {
  const [hasPermission, setHasPermission] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkPermissions()
  }, [])

  const checkPermissions = async () => {
    try {
      setIsLoading(true)
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasPermission(false)
        return
      }

      // Check if permission is already granted
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'microphone' })
        setHasPermission(permission.state === 'granted')
        
        permission.addEventListener('change', () => {
          setHasPermission(permission.state === 'granted')
        })
      } else {
        // Fallback for browsers without permissions API
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(track => track.stop())
          setHasPermission(true)
        } catch (error) {
          setHasPermission(false)
        }
      }
    } catch (error) {
      console.error('Error checking audio permissions:', error)
      setHasPermission(false)
    } finally {
      setIsLoading(false)
    }
  }

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setHasPermission(true)
      return true
    } catch (error) {
      console.error('Error requesting audio permission:', error)
      setHasPermission(false)
      return false
    }
  }

  return {
    hasPermission,
    isLoading,
    requestPermission,
    checkPermissions
  }
}