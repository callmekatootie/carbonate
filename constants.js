const IMAGE_FILE_EXT = '.png'

const IMGUR_API_URL = 'https://api.imgur.com/3/image'

const CARBON_API_URL = 'https://carbonara.now.sh/api/cook'

const CARBON_DEFAULT_SETTINGS = {
  paddingVertical: '56px',
  paddingHorizontal: '56px',
  backgroundColor: 'rgba(74,144,226,1)',
  dropShadow: true,
  dropShadowOffsetY: '20px',
  dropShadowBlurRadius: '68px',
  theme: 'one-dark',
  windowTheme: 'none',
  language: 'auto',
  fontFamily: 'Hack',
  fontSize: '14px',
  lineHeight: '143%',
  windowControls: false,
  widthAdjustment: true,
  lineNumbers: false,
  exportSize: '2x',
  watermark: false
}

module.exports = {
  IMAGE_FILE_EXT,
  IMGUR_API_URL,
  CARBON_API_URL,
  CARBON_DEFAULT_SETTINGS
}
