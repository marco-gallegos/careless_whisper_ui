import AudioRecorder from './AudioRecorder'
import { AudioTranslationProvider } from '../context/AudioTranslationContext'

export default {
  title: 'Components/AudioRecorder',
  component: AudioRecorder,
  decorators: [
    (Story) => (
      <AudioTranslationProvider>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <Story />
        </div>
      </AudioTranslationProvider>
    ),
  ],
}

export const Default = {
  args: {},
}

export const WithError = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'AudioRecorder component with error state simulation',
      },
    },
  },
}