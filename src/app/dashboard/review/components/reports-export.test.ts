import {describe, expect, it} from 'vitest'
import {buildCsv, csvNumber} from './reports-export'

describe('csvNumber', () => {
  it('пишет дробную часть ЗАПЯТОЙ', () => {
    // С точкой русский Excel принял бы 16.83 за текст или за дату, и столбец
    // сумм перестал бы складываться. Та же причина, что у `sep=;`.
    expect(csvNumber(16.83)).toBe('16,83')
  })

  it('целые пишет без дробной части', () => {
    // «55,00 ₼» рядом с ценой «55 ₼» читалось бы как другая сумма.
    expect(csvNumber(55)).toBe('55')
  })

  it('округляет до копеек', () => {
    expect(csvNumber(16.8333)).toBe('16,83')
  })
})

describe('buildCsv', () => {
  it('ставит sep=; первой строкой', () => {
    // Это указание самому Excel: без него файл с точками с запятой лёг бы в
    // один столбец.
    const csv = buildCsv([{title: 'Отчёт', head: ['А'], rows: [['1']]}])
    expect(csv.split('\r\n')[0]).toBe('sep=;')
  })

  it('разделяет строки CRLF', () => {
    // С одними переводами строки Excel склеивает всё в одну строку.
    const csv = buildCsv([{title: 'Отчёт', head: [], rows: [['1']]}])
    expect(csv).toBe('sep=;\r\nОтчёт\r\n1')
  })

  it('берёт в кавычки поле с точкой с запятой', () => {
    const csv = buildCsv([{title: 'Т', head: [], rows: [['Баку; Сумгаит']]}])
    expect(csv).toContain('"Баку; Сумгаит"')
  })

  it('удваивает кавычки внутри поля', () => {
    const csv = buildCsv([{title: 'Т', head: [], rows: [['дом "Чайка"']]}])
    expect(csv).toContain('"дом ""Чайка"""')
  })

  it('не теряет строку с переводом строки внутри поля', () => {
    const csv = buildCsv([{title: 'Т', head: [], rows: [['первая\nвторая']]}])
    expect(csv).toContain('"первая\nвторая"')
  })

  it('пустое поле отдаёт пустым, а не словом undefined', () => {
    const csv = buildCsv([{title: 'Т', head: [], rows: [['', 5]]}])
    expect(csv.endsWith(';5')).toBe(true)
  })

  it('разделяет разделы пустой строкой и пропускает пустую шапку', () => {
    const csv = buildCsv([
      {title: 'Сводка', head: [], rows: [['Регистрации', 3]]},
      {title: 'Люди', head: ['Имя'], rows: [['Орхан']]}
    ])
    expect(csv.split('\r\n')).toEqual([
      'sep=;',
      'Сводка',
      'Регистрации;3',
      '',
      'Люди',
      'Имя',
      'Орхан'
    ])
  })
})
