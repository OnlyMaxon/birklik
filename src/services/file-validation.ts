// Проверка файлов перед загрузкой в Storage.
//
// До этого модуль вызывался только из тестов: приложение грузило что угодно, а
// тип и размер отбивали правила Storage — пользователь вместо понятного текста
// получал невнятный отказ хранилища. Теперь проверка стоит на самом пути
// загрузки, поэтому и правила здесь должны быть посильными для живых имён файлов.

export interface FileValidationResult {
  valid: boolean
  error?: string
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5MB

// Разделители пути, переход на уровень выше и управляющие символы, включая NUL.
// Диапазон задан кодами намеренно: в буквальном виде класс управляющих символов
// легко спутать с «пробел или дефис», а такая опечатка отвергала бы обычные имена.
const DANGEROUS_FILENAME = new RegExp('[/\\\\]|\\.\\.|[\\u0000-\\u001f]')

/**
 * Имя файла: запрещено только то, что действительно опасно в пути хранилища.
 *
 * Прежнее правило требовало `^[a-zA-Z0-9_\-. ]+$` — то есть отвергало любое имя с
 * кириллицей или азербайджанскими буквами: `фото.jpg`, `şəkil.jpg`. Пока проверка
 * не вызывалась, это никому не мешало; включи её в загрузку — и половина здешних
 * телефонов упёрлась бы в отказ на ровном месте.
 *
 * Имя попадает в путь `properties/{uid}/{timestamp}_{name}`, поэтому опасны
 * разделители и управляющие символы, а не алфавит.
 */
function validateFilename(filename: string): FileValidationResult {
  if (!filename || filename.trim() === '') {
    return { valid: false, error: 'Filename is empty' }
  }
  if (filename.length > 200) {
    return { valid: false, error: 'Filename is too long' }
  }
  if (DANGEROUS_FILENAME.test(filename)) {
    return { valid: false, error: 'Filename contains invalid characters' }
  }
  return { valid: true }
}

/**
 * Проверяет фотографию объявления: тип, размер, имя файла.
 */
export const validatePropertyImage = (file: File): FileValidationResult => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: JPEG, PNG, WebP. Got: ${file.type}`
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Max: 10MB, Got: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    }
  }

  return validateFilename(file.name)
}

/**
 * Проверяет аватар — те же правила, но вдвое строже по размеру.
 */
export const validateAvatar = (file: File): FileValidationResult => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Use JPEG, PNG, or WebP'
    }
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return {
      valid: false,
      error: `Avatar too large. Max: 5MB, Got: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    }
  }

  return validateFilename(file.name)
}

/**
 * Пакетная проверка: подходят все файлы или не подходит ни один.
 *
 * Общего ограничения на суммарный вес здесь больше нет. Оно стояло на пяти файлах
 * (`MAX_FILE_SIZE * 5`), тогда как объявление допускает 20 фотографий у Standard и
 * VIP и 30 у Premium — то есть законная загрузка упиралась бы в него сразу.
 * Каждый файл ограничен своим размером, этого достаточно.
 */
export const validateMultipleFiles = (files: FileList | File[], isAvatar = false): FileValidationResult => {
  const fileArray = Array.from(files)

  if (fileArray.length === 0) {
    return { valid: false, error: 'No files selected' }
  }

  const validator = isAvatar ? validateAvatar : validatePropertyImage
  for (const file of fileArray) {
    const result = validator(file)
    if (!result.valid) return result
  }

  return { valid: true }
}
