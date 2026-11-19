import {describe, expect, it} from 'vitest'
import {blank, buildXlsx, columnName, date, downloadXlsx, excelDate, label, money, number, sheetName, text} from './xlsx'

/**
 * Проверки сборщика книги Excel.
 *
 * Главное, ради чего он написан, — **кракозябры**. Поэтому тесты не просто
 * смотрят на строки, а разбирают готовый zip обратно и читают байты: ошибка
 * кодировки видна только там, а в исходной строке всё всегда красиво.
 */

/** Разбор zip без сжатия: ровно то, что умеет читать Excel в нашем случае. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder('utf-8', {fatal: true})
  const files = new Map<string, string>()
  let at = 0
  while (at + 4 <= bytes.length && view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 22, true)
    const nameLength = view.getUint16(at + 26, true)
    const extraLength = view.getUint16(at + 28, true)
    const name = decoder.decode(bytes.subarray(at + 30, at + 30 + nameLength))
    const start = at + 30 + nameLength + extraLength
    files.set(name, decoder.decode(bytes.subarray(start, start + size)))
    // Если бы длина в заголовке врала, здесь мы встали бы не на подпись
    // следующей записи и цикл оборвался бы — счёт записей это ловит.
    at = start + size
  }
  return files
}

/** Своя crc32 — нарочно вторая, чтобы сверять рабочую, а не саму себя. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i]
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

const oneSheet = (rows: ReturnType<typeof text>[][], head?: string[]) =>
  buildXlsx([{name: 'Лист', widths: [20, 20], head, rows}])

const sheet1 = (book: Uint8Array) => unzip(book).get('xl/worksheets/sheet1.xml') ?? ''

describe('книга целиком', () => {
  it('собирает все обязательные части пакета', () => {
    const files = unzip(buildXlsx([{name: 'A', widths: [10], rows: []}]))
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml'
    ])
  })

  it('на каждый лист кладёт свою часть и свою связь', () => {
    const files = unzip(buildXlsx([
      {name: 'A', widths: [10], rows: []},
      {name: 'B', widths: [10], rows: []},
      {name: 'C', widths: [10], rows: []}
    ]))
    expect(files.has('xl/worksheets/sheet3.xml')).toBe(true)
    const rels = files.get('xl/_rels/workbook.xml.rels') ?? ''
    expect(rels).toContain('Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"')
    // Оформление — последней связью, её номер обязан не столкнуться с листами.
    expect(rels).toContain('Id="rId4"')
    expect(rels).toContain('Target="styles.xml"')
  })

  it('пишет честную контрольную сумму каждой записи', () => {
    // Соврёт crc — Excel объявит книгу повреждённой и предложит восстановить.
    const book = buildXlsx([{name: 'A', widths: [10], rows: [[text('Xəyal')]]}])
    const view = new DataView(book.buffer, book.byteOffset, book.byteLength)
    let at = 0
    let checked = 0
    while (at + 4 <= book.length && view.getUint32(at, true) === 0x04034b50) {
      const size = view.getUint32(at + 22, true)
      const nameLength = view.getUint16(at + 26, true)
      const start = at + 30 + nameLength + view.getUint16(at + 28, true)
      expect(view.getUint32(at + 14, true)).toBe(crc32(book.subarray(start, start + size)))
      checked += 1
      at = start + size
    }
    expect(checked).toBe(6)
  })

  it('без листов не собирается вовсе', () => {
    expect(() => buildXlsx([])).toThrow()
  })

  it('от одних и тех же данных даёт одни и те же байты', () => {
    // Время внутри zip прибито гвоздями ровно ради этого.
    const make = () => buildXlsx([{name: 'A', widths: [10], rows: [[text('Xəyal')]]}])
    expect(make()).toEqual(make())
  })
})

describe('буквы', () => {
  it('азербайджанские и кириллицу отдаёт в UTF-8, а не кашей', () => {
    // ТА САМАЯ болезнь CSV: `XÉ™yal` вместо `Xəyal`. В zip лежат байты, и
    // `TextDecoder` с `fatal: true` не простил бы ни однобайтовой кодировки,
    // ни обрезанной последовательности.
    const xml = sheet1(oneSheet([[text('Xəyal Əliyev'), text('Бабək Гусейнов')]]))
    expect(xml).toContain('Xəyal Əliyev')
    expect(xml).toContain('Бабək Гусейнов')
    expect(xml).not.toContain('É™')
  })

  it('экранирует то, что порвало бы XML', () => {
    const xml = sheet1(oneSheet([[text('Чайка & «дом» <b> "у моря"')]]))
    expect(xml).toContain('&amp;')
    expect(xml).toContain('&lt;b&gt;')
    expect(xml).not.toContain('<b>')
  })

  it('выбрасывает управляющие знаки, а не экранирует их', () => {
    // `&#1;` в XML 1.0 записи не имеет: Excel показал бы «нечитаемое
    // содержимое» и предложил восстановить книгу.
    const dirty = `Ор${String.fromCharCode(1)}хан${String.fromCharCode(27)}`
    const xml = sheet1(oneSheet([[text(dirty)]]))
    expect(xml).toContain('>Орхан<')
    expect(xml).not.toContain('&#')
    expect(xml).not.toContain(String.fromCharCode(1))
  })

  it('сохраняет пробелы по краям', () => {
    expect(sheet1(oneSheet([[text(' Орхан ')]]))).toContain('xml:space="preserve"> Орхан <')
  })
})

describe('виды ячеек', () => {
  it('деньги кладёт ЧИСЛОМ с денежным оформлением — столбец должен складываться', () => {
    const xml = sheet1(oneSheet([[money(340)]]))
    expect(xml).toContain('<c r="A1" s="3"><v>340</v></c>')
    // Ни кавычек, ни знака маната в значении: знак рисует оформление.
    expect(xml).not.toContain('340 ₼')
  })

  it('деньги округляет до копеек', () => {
    expect(sheet1(oneSheet([[money(16.8333)]]))).toContain('<v>16.83</v>')
  })

  it('дату кладёт числом с датным оформлением', () => {
    expect(sheet1(oneSheet([[date('2026-11-17T09:00:00.000Z')]]))).toContain('<c r="A1" s="2"><v>46343</v></c>')
  })

  it('пустую и нечитаемую дату оставляет пустой ячейкой', () => {
    // Нулём нельзя: Excel покажет «00.01.1900», и в отчёте появится запись из
    // позапрошлого века.
    expect(sheet1(oneSheet([[date(undefined), date('не дата')]]))).toContain('<row r="1"></row>')
  })

  it('пустую строку и blank не пишет вовсе', () => {
    expect(sheet1(oneSheet([[text(''), blank, number(0)]]))).toContain('<row r="1"><c r="C1"><v>0</v></c></row>')
  })

  it('подпись пишет жирным оформлением', () => {
    expect(sheet1(oneSheet([[label('Оплаты')]]))).toContain('s="6"')
  })
})

describe('excelDate', () => {
  it('считает день по БАКИНСКОМУ времени', () => {
    // 21:00 UTC 30 ноября — это уже 01:00 первого декабря в Баку. Считай по
    // UTC, и запись попала бы в лист за декабрь строкой «30 ноября».
    expect(excelDate('2026-11-30T21:00:00.000Z')).toBe(46357)
    expect(excelDate('2026-11-30T19:00:00.000Z')).toBe(46356)
  })

  it('отрезает время, чтобы две записи одного дня не сортировались по часам', () => {
    expect(excelDate('2026-11-17T06:00:00.000Z')).toBe(excelDate('2026-11-17T17:00:00.000Z'))
  })

  it('нечитаемую дату отдаёт null, а не нулём', () => {
    expect(excelDate('')).toBeNull()
  })
})

describe('имя листа', () => {
  it('меняет знаки, которых Excel не прощает', () => {
    // С таким знаком Excel объявит повреждённой всю книгу, а не один ярлычок.
    expect(sheetName('Брони/Отмены', new Set())).toBe('Брони Отмены')
  })

  it('режет до 31 знака', () => {
    expect(sheetName('я'.repeat(40), new Set())).toHaveLength(31)
  })

  it('разводит одинаковые имена, не вылезая за предел', () => {
    const taken = new Set<string>()
    expect(sheetName('Оплаты', taken)).toBe('Оплаты')
    expect(sheetName('Оплаты', taken)).toBe('Оплаты (2)')
    const long = 'я'.repeat(40)
    sheetName(long, taken)
    expect(sheetName(long, taken)).toHaveLength(31)
  })

  it('пустое имя подменяет, а не оставляет пустым', () => {
    expect(sheetName('   ', new Set())).toBe('Sheet')
  })
})

describe('шапка, ширина и фильтр', () => {
  it('задаёт ширину каждому столбцу — без неё даты показываются как ########', () => {
    expect(sheet1(buildXlsx([{name: 'A', widths: [30, 12], rows: []}])))
      .toContain('<col min="2" max="2" width="12" customWidth="1"/>')
  })

  it('закрепляет строку шапки и вешает автофильтр', () => {
    const xml = sheet1(oneSheet([[text('Орхан'), text('+994')]], ['Имя', 'Телефон']))
    expect(xml).toContain('ySplit="1"')
    expect(xml).toContain('<autoFilter ref="A1:B2"/>')
  })

  it('под заголовком листа считает строки со сдвигом', () => {
    const book = buildXlsx([{
      name: 'A', title: 'Birklik.az', widths: [20, 20], head: ['Имя', 'Телефон'], rows: [[text('Орхан'), blank]]
    }])
    // строка 1 — заголовок, 2 — пустая, 3 — шапка, 4 — данные
    expect(sheet1(book)).toContain('ySplit="3"')
    expect(sheet1(book)).toContain('<autoFilter ref="A3:B4"/>')
  })

  it('на пустой таблице фильтр не вешает — Excel ругается на пустой диапазон', () => {
    expect(sheet1(buildXlsx([{name: 'A', widths: [20], head: ['Имя'], rows: []}]))).not.toContain('autoFilter')
  })

  it('без шапки не закрепляет ничего', () => {
    expect(sheet1(oneSheet([[text('Орхан')]]))).not.toContain('ySplit')
  })

  it('оговорки кладёт под таблицу через пустую строку', () => {
    const xml = sheet1(buildXlsx([{
      name: 'A', widths: [20], head: ['Имя'], rows: [[text('Орхан')]], notes: ['Суммы брутто']
    }]))
    // 1 — шапка, 2 — данные, 3 — отбивка (её в файле нет), 4 — оговорка
    expect(xml).toContain('<row r="4"><c r="A4" s="5"')
    expect(xml).toContain('Суммы брутто')
  })
})

describe('columnName', () => {
  it('считает за пределом одной буквы', () => {
    expect([1, 26, 27, 52, 53].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA'])
  })
})

describe('скачивание', () => {
  it('отдаёт файл под нужным именем и с типом книги Excel', () => {
    // Кнопка — единственное место, где всё собранное встречается с браузером.
    // Ошибись здесь в типе, и Windows откроет файл не Excel'ем, а чем попало.
    const created: Blob[] = []
    const clicked: HTMLAnchorElement[] = []
    const url = globalThis.URL as unknown as {
      createObjectURL?: (blob: Blob) => string
      revokeObjectURL?: (value: string) => void
    }
    // jsdom этих двух не умеет вовсе — подставляем.
    url.createObjectURL = blob => {
      created.push(blob)
      return 'blob:птичка'
    }
    let revoked = ''
    url.revokeObjectURL = value => {
      revoked = value
    }
    const click = HTMLAnchorElement.prototype.click
    // Связь с деревом снимаем ЗДЕСЬ: после нажатия ссылка уже убрана, и
    // проверять её потом бессмысленно.
    let connectedAtClick = false
    HTMLAnchorElement.prototype.click = function patched(this: HTMLAnchorElement) {
      connectedAtClick = this.isConnected
      clicked.push(this)
    }

    try {
      downloadXlsx('birklik-2026-11.xlsx', buildXlsx([{name: 'A', widths: [10], rows: [[text('Xəyal')]]}]))
    } finally {
      HTMLAnchorElement.prototype.click = click
    }

    expect(created).toHaveLength(1)
    expect(created[0].type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(created[0].size).toBeGreaterThan(0)
    expect(clicked[0].download).toBe('birklik-2026-11.xlsx')
    // Ссылку надо было положить в документ: Firefox не нажимает ту, что не в дереве.
    expect(connectedAtClick).toBe(true)
    // И убрать за собой: иначе blob висит в памяти до перезагрузки страницы.
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revoked).toBe('blob:птичка')
  })
})
