/**
 * i18n Validation Script
 * Validates that all translation keys are present in all language files
 * This can be run as part of the build process
 */

import { az, en, ru } from './i18n'

type Language = typeof az | typeof en | typeof ru
type TranslationKey = string

/**
 * Recursively get all keys from translation object
 */
const getAllKeys = (obj: any, prefix = ''): TranslationKey[] => {
  const keys: TranslationKey[] = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (value === null || value === undefined) {
      keys.push(fullKey)
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }

  return keys
}

/**
 * Get value from nested object using dot notation
 */
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, part) => current?.[part], obj)
}

/**
 * Validate that all keys exist in all languages
 */
export const validateTranslations = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  const languages = { en, ru, az }
  const baseKeys = getAllKeys(en)

  // Check each language
  for (const [langCode, langObj] of Object.entries(languages)) {
    const langKeys = getAllKeys(langObj)

    // Check for missing keys
    const missingKeys = baseKeys.filter((key) => !langKeys.includes(key))
    if (missingKeys.length > 0) {
      errors.push(
        `Language "${langCode}" is missing keys: ${missingKeys.join(', ')}`
      )
    }

    // Check for extra keys (keys that shouldn't exist)
    const extraKeys = langKeys.filter((key) => !baseKeys.includes(key))
    if (extraKeys.length > 0) {
      errors.push(
        `Language "${langCode}" has extra/orphaned keys: ${extraKeys.join(', ')}`
      )
    }

    // Check for null/undefined values
    for (const key of baseKeys) {
      const value = getNestedValue(langObj, key)
      if (value === null || value === undefined || value === '') {
        errors.push(`Language "${langCode}" has empty value for key: ${key}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Generate missing translation keys with placeholder values
 */
export const generateMissingTranslations = (lang: Language) => {
  const baseKeys = getAllKeys(en)
  const langKeys = getAllKeys(lang)
  const missingKeys = baseKeys.filter((key) => !langKeys.includes(key))

  if (missingKeys.length === 0) {
    console.log('No missing translations')
    return {}
  }

  const missing: any = {}
  for (const key of missingKeys) {
    const parts = key.split('.')
    let current = missing

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {}
      }
      current = current[parts[i]]
    }

    current[parts[parts.length - 1]] = `[MISSING: ${key}]`
  }

  return missing
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateTranslations()

  if (result.valid) {
    console.log('✓ All translations are valid!')
    process.exit(0)
  } else {
    console.error('✗ Translation validation failed:')
    result.errors.forEach((error) => console.error(`  - ${error}`))
    process.exit(1)
  }
}
