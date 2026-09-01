import { describe, it, expect } from 'vitest'
import { validatePropertyImage, validateAvatar, validateMultipleFiles } from './file-validation'

// Тесты про pagination-helper убраны вместе с самим модулем: он не вызывался
// ниоткуда, а его сортировка по `premiumExpiresAt` при оживлении выбросила бы из
// выдачи все объявления без этого поля. Бессмысленной проверки «Service
// Integration», сравнивавшей длины двух литералов, тоже больше нет.

describe('Проверка файлов', () => {
  describe('фотография объявления', () => {
    it('принимает JPEG', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      expect(validatePropertyImage(file).valid).toBe(true)
    })

    it('отклоняет неподходящий тип', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const result = validatePropertyImage(file)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('отклоняет файл тяжелее 10 МБ', () => {
      const file = new File([new ArrayBuffer(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      expect(validatePropertyImage(file).valid).toBe(false)
    })

    it('принимает кириллицу и азербайджанские буквы в имени', () => {
      // Прежнее правило требовало только латиницу и отвергло бы оба имени.
      // Пока проверка не вызывалась, это не всплывало; теперь она на пути загрузки.
      for (const name of ['фото.jpg', 'şəkil.jpg', 'Mərdəkan həyət evi.jpg']) {
        expect(validatePropertyImage(new File(['x'], name, { type: 'image/jpeg' })).valid).toBe(true)
      }
    })

    it('принимает пробелы и дефисы в имени', () => {
      for (const name of ['my photo.jpg', 'photo-1.jpg']) {
        expect(validatePropertyImage(new File(['x'], name, { type: 'image/jpeg' })).valid).toBe(true)
      }
    })

    it('отклоняет разделители пути и переход на уровень выше', () => {
      for (const name of ['../secret.jpg', 'dir/photo.jpg', 'dir\\photo.jpg']) {
        expect(validatePropertyImage(new File(['x'], name, { type: 'image/jpeg' })).valid).toBe(false)
      }
    })

    it('отклоняет управляющий символ в имени', () => {
      const name = `photo${String.fromCharCode(0)}.jpg`
      expect(validatePropertyImage(new File(['x'], name, { type: 'image/jpeg' })).valid).toBe(false)
    })
  })

  describe('аватар', () => {
    it('принимает PNG', () => {
      const file = new File(['content'], 'avatar.png', { type: 'image/png' })
      expect(validateAvatar(file).valid).toBe(true)
    })

    it('держит более строгий предел размера', () => {
      const file = new File([new ArrayBuffer(6 * 1024 * 1024)], 'avatar.jpg', { type: 'image/jpeg' })
      expect(validateAvatar(file).valid).toBe(false)
    })
  })

  describe('пакетная проверка', () => {
    it('отклоняет пустой список', () => {
      const result = validateMultipleFiles([])
      expect(result.valid).toBe(false)
      expect(result.error).toContain('No files selected')
    })

    it('пропускает набор годных файлов', () => {
      const files = [
        new File(['content'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['content'], 'test2.png', { type: 'image/png' })
      ]
      expect(validateMultipleFiles(files).valid).toBe(true)
    })

    it('пропускает 25 фотографий подряд', () => {
      // Прежний общий лимит стоял на пяти файлах, а объявление допускает
      // 20 у Standard и VIP и 30 у Premium — законная загрузка в него упиралась.
      const files = Array.from({length: 25}, (_, i) =>
        new File([new ArrayBuffer(1024 * 1024)], `photo-${i}.jpg`, { type: 'image/jpeg' })
      )
      expect(validateMultipleFiles(files).valid).toBe(true)
    })

    it('отклоняет набор, если плох хотя бы один файл', () => {
      const files = [
        new File(['content'], 'ok.jpg', { type: 'image/jpeg' }),
        new File(['content'], 'bad.txt', { type: 'text/plain' })
      ]
      expect(validateMultipleFiles(files).valid).toBe(false)
    })
  })
})
