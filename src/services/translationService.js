// Mock translation service - replace with actual API calls
export async function translateAudio(
  audioBlobData,
  audioBlobDataType = "audio/webm;codecs=opus"
) {
  // Simulate API call delay
  // await new Promise((resolve) =>
  //   setTimeout(resolve, 2000 + Math.random() * 3000)
  // );

  // Mock translation based on audio duration
  // const duration = audioBlob.size / 1000; // Rough estimate

  // if (duration < 2) {
  //   return "Hello, this is a short audio translation."
  // } else if (duration < 5) {
  //   return "This is a medium length audio translation. The system has successfully converted your speech to text."
  // } else {
  //   return "This is a longer audio translation. The advanced speech recognition system has processed your audio file and converted it into readable text format. This demonstrates the capability of the translation service to handle various audio lengths and complexities."
  // }
  //
  //
  // Si tienes un blob de audio
  const audioBlob = new Blob([audioBlobData], { type: audioBlobDataType });

  // Crear FormData
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");

  // Realizar la petición
  const response = await fetch("http://localhost:8000/upload-audio/", {
    method: "POST",
    headers: {
      accept: "application/json",
      Authentication:
        "e9b7658aa93342c492fa64153849c68b8md9uBmaqCwKq4VcgkuBD0G54FmsE8JT",
      // No incluir Content-Type aquí, fetch lo establece automáticamente con boundary
    },
    body: formData,
  });

  const data = await response.json();

  console.debug(data);

  return `Done: ${data.message}`;
}

// Configuration for actual translation services
export const translationConfig = {
  // OpenAI Whisper API
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    model: "whisper-1",
  },

  // Google Speech-to-Text
  google: {
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
    endpoint: "https://speech.googleapis.com/v1/speech:recognize",
  },

  // Azure Speech Services
  azure: {
    apiKey: import.meta.env.VITE_AZURE_API_KEY,
    region: import.meta.env.VITE_AZURE_REGION,
    endpoint:
      "https://[region].stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1",
  },
};

// Actual implementation for OpenAI Whisper (commented out for now)
/*
export async function translateAudioWithOpenAI(audioBlob) {
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.wav')
  formData.append('model', 'whisper-1')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${translationConfig.openai.apiKey}`
    },
    body: formData
  })

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.statusText}`)
  }

  const result = await response.json()
  return result.text
}
*/
