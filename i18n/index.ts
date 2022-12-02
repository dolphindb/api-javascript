import { I18N } from 'xshell/i18n/index.js'
import _dict from './dict.json' assert { type: 'json' }

export let i18n = new I18N(_dict)
const { t, language } = i18n
export { t, language }
