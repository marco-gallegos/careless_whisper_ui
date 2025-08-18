import TranslationHistory from './TranslationHistory'
import { AudioTranslationProvider } from '../context/AudioTranslationContext'

export default {
  title: 'Components/TranslationHistory',
  component: TranslationHistory,
  decorators: [
    (Story) => (
      <AudioTranslationProvider>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Story />
        </div>
      </AudioTranslationProvider>
    ),
  ],
}

export const Empty = {
  args: {},
}

export const WithTranslations = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Translation history with sample data',
      },
    },
  },
}