/**
 * Сборка настоящей книги Excel (`.xlsx`) прямо в браузере, без единого пакета.
 *
 * ## Почему не CSV
 *
 * Раньше отчёт выгружался в CSV, и у него была неизлечимая болезнь: **имена
 * приезжали кашей** — `XÉ™yal` вместо `Xəyal`, `â€"` вместо тире. Причина не в
 * забытом BOM, он как раз стоял. Виновата была строка `sep=;` в начале файла:
 * **увидев её, Excel уходит на старый путь разбора и BOM больше не смотрит** —
 * то есть читает UTF-8 как однобайтовую кодировку. Одновременно иметь в CSV и
 * правильный разделитель, и правильные буквы НЕЛЬЗЯ: уберёшь `sep=;` —
 * вернутся буквы, но на машине с запятой-разделителем отчёт ляжет одним
 * столбцом.
 *
 * В `.xlsx` этой развилки нет вовсе. Внутри — XML с объявленной кодировкой,
 * гадать Excel не о чем. Заодно появляется всё, чего у CSV не бывает в
 * принципе:
 *
 * ```
 * ширина столбцов   даты больше не показываются как ########
 * настоящие даты    сортируются как даты, а не как текст
 * настоящие числа   столбец сумм складывается
 * несколько листов  каждый раздел отдельно, а не всё в одной простыне
 * закрепление строк шапка не уезжает при прокрутке
 * автофильтр        сортировка и отбор без лишних движений
 * ```
 *
 * ## Почему руками, а не библиотекой
 *
 * `.xlsx` — это zip с несколькими XML. Библиотеки для него весят от 400 КБ
 * (SheetJS, ExcelJS) и тянут свои зависимости, а нужна нам ровно запись: ни
 * чтения чужих книг, ни формул, ни картинок. Весь сборщик — этот файл.
 *
 * ⚠️ **Записи в zip кладутся БЕЗ сжатия (метод `store`).** Так zip обходится
 * без deflate, которого в браузере синхронно нет, а deflate тянул бы ещё один
 * пакет. Такой zip полностью законен, Excel его открывает. Цена — размер:
 * отчёт за месяц выходит в районе сотни килобайт вместо десятка. Для файла,
 * который сохраняют на диск, это ничего не значит.
 *
 * ⚠️ **Время внутри zip прибито гвоздями.** Не для красоты: при текущем
 * времени один и тот же отчёт давал бы разные байты каждую секунду, и тест
 * «собралось ровно это» писать было бы не на чем.
 */

import {BAKU_OFFSET_MS} from '@birklik/core/utils/months'

/* ========================================================================== *
 *  Ячейка
 * ========================================================================== */

/**
 * Что кладём в ячейку.
 *
 * Дата и деньги — отдельные виды, а не заранее отформатированный текст, и это
 * главное отличие от прежнего CSV. Текстом `17.11.2026` не отсортируешь по
 * возрастанию, а текстом `340 ₼` не возьмёшь сумму столбца; числом и датой —
 * можно, и владелец получает таблицу, с которой можно работать, а не картинку
 * таблицы.
 */
export type XlsxCell =
  | {kind: 'text'; value: string}
  | {kind: 'number'; value: number}
  | {kind: 'money'; value: number}
  /** ISO-строка из Firestore. Пустая или нечитаемая — ячейка останется пустой. */
  | {kind: 'date'; value: string | undefined}
  /** Подпись строки жирным — левый столбец сводки. */
  | {kind: 'label'; value: string}
  | {kind: 'blank'}

export const text = (value: string | undefined | null): XlsxCell => ({kind: 'text', value: value ?? ''})
export const number = (value: number): XlsxCell => ({kind: 'number', value})
export const money = (value: number | undefined | null): XlsxCell => ({kind: 'money', value: value ?? 0})
export const date = (value: string | undefined): XlsxCell => ({kind: 'date', value})
export const label = (value: string): XlsxCell => ({kind: 'label', value})
export const blank: XlsxCell = {kind: 'blank'}

export interface XlsxSheet {
  /** Имя ярлычка внизу книги. Длину и запрещённые знаки чиним сами — см. `sheetName`. */
  name: string
  /** Крупная строка над таблицей. Без неё таблица начинается с первой строки. */
  title?: string
  /** Ширина столбцов В ЗНАКАХ. Длина массива задаёт число столбцов листа. */
  widths: number[]
  /** Шапка. Без неё не будет ни закрепления строки, ни автофильтра — закреплять нечего. */
  head?: string[]
  rows: XlsxCell[][]
  /** Оговорки под таблицей, каждая своей строкой серым. */
  notes?: string[]
}

/* ========================================================================== *
 *  XML
 * ========================================================================== */

/**
 * Экранирование для XML.
 *
 * ⚠️ Управляющие знаки выкидываем, а не экранируем: в XML 1.0 им НЕТ записи
 * вовсе, и `&#1;` сделал бы файл битым — Excel показал бы «нечитаемое
 * содержимое» и предложил восстановить книгу. В именах из базы такой знак
 * однажды окажется, и падать из-за него отчёт не должен.
 */
const xml = (value: string): string =>
  value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** `1` → `A`, `27` → `AA`. Столбцов у нас восемь, но считать правильно дешевле, чем помнить про предел. */
export function columnName(index: number): string {
  let name = ''
  let rest = index
  while (rest > 0) {
    const remainder = (rest - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    rest = Math.floor((rest - remainder) / 26)
  }
  return name
}

/**
 * Имя листа по правилам Excel: не длиннее 31 знака и без `: \ / ? * [ ]`.
 *
 * ⚠️ Имя с запрещённым знаком Excel не «поправит сам» — он объявит книгу
 * повреждённой целиком. Названия разделов берутся из словаря, и достаточно
 * однажды написать в переводе «Брони/Отмены», чтобы выгрузка перестала
 * открываться.
 */
export function sheetName(raw: string, taken: Set<string>): string {
  const cleaned = raw.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet'
  if (!taken.has(cleaned)) {
    taken.add(cleaned)
    return cleaned
  }
  // Одинаковых ярлычков Excel тоже не прощает. Дописываем номер, подрезая имя
  // так, чтобы вместе они всё ещё влезли в 31 знак.
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`
    const candidate = cleaned.slice(0, 31 - suffix.length) + suffix
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
  }
}

/**
 * Дата в число Excel.
 *
 * Отсчёт идёт от 30 декабря 1899 года — да, от тридцатого: Excel ради
 * совместимости с Lotus считает 1900 год високосным, и смещение на день уже
 * зашито в эпоху. Поэтому `25569`, а не `25568`.
 *
 * ⚠️ Час берём БАКИНСКИЙ, тем же сдвигом, что и `bakuMonth`. Иначе запись,
 * сделанная в 02:00 первого числа, попала бы в лист за свой месяц, но строкой
 * с последним числом предыдущего — и список перестал бы сходиться со сводкой
 * над ним.
 */
export function excelDate(iso: string): number | null {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  // Отрезаем время: в отчёте важен день, а остаток суток дал бы дробь и
  // «17.11.2026» в двух строках сортировалось бы по невидимым часам.
  return Math.floor((ms + BAKU_OFFSET_MS) / 86400000) + 25569
}

/* --- номера оформления из styles.xml ниже; порядок менять нельзя -----------
   Нулевого здесь нет нарочно: обычная ячейка пишется вовсе без `s`, и ноль
   пришлось бы проставлять руками каждой из тысячи. */
const STYLE_HEAD = 1
const STYLE_DATE = 2
const STYLE_MONEY = 3
const STYLE_TITLE = 4
const STYLE_NOTE = 5
const STYLE_BOLD = 6

function cellXml(ref: string, cell: XlsxCell): string {
  if (cell.kind === 'blank') return ''
  if (cell.kind === 'number') {
    return Number.isFinite(cell.value) ? `<c r="${ref}"><v>${cell.value}</v></c>` : ''
  }
  if (cell.kind === 'money') {
    const rounded = Math.round((Number(cell.value) || 0) * 100) / 100
    return `<c r="${ref}" s="${STYLE_MONEY}"><v>${rounded}</v></c>`
  }
  if (cell.kind === 'date') {
    if (!cell.value) return ''
    const serial = excelDate(cell.value)
    // Нечитаемую дату оставляем пустой ячейкой, а не нулём: ноль Excel покажет
    // как «00.01.1900», и в отчёте появится запись из позапрошлого века.
    return serial === null ? '' : `<c r="${ref}" s="${STYLE_DATE}"><v>${serial}</v></c>`
  }
  if (!cell.value) return ''
  if (cell.kind === 'label') {
    return `<c r="${ref}" s="${STYLE_BOLD}" t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`
  }
  // Строку кладём прямо в ячейку (`inlineStr`), а не в общий словарь строк:
  // словарь экономит место на повторах, которых в отчёте почти нет, а кода
  // стоит вдвое больше.
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`
}

function rowXml(index: number, cells: string[]): string {
  return `<row r="${index}">${cells.join('')}</row>`
}

function sheetXml(sheet: XlsxSheet): string {
  const rows: string[] = []
  let r = 0

  if (sheet.title) {
    r += 1
    rows.push(rowXml(r, [`<c r="A${r}" s="${STYLE_TITLE}" t="inlineStr"><is><t xml:space="preserve">${xml(sheet.title)}</t></is></c>`]))
    r += 1 // пустая строка-отбивка между заголовком и таблицей
  }

  let headRow = 0
  if (sheet.head && sheet.head.length > 0) {
    r += 1
    headRow = r
    rows.push(rowXml(r, sheet.head.map((label, i) =>
      `<c r="${columnName(i + 1)}${r}" s="${STYLE_HEAD}" t="inlineStr"><is><t xml:space="preserve">${xml(label)}</t></is></c>`
    )))
  }

  const firstDataRow = r + 1
  sheet.rows.forEach(cells => {
    r += 1
    rows.push(rowXml(r, cells.map((cell, i) => cellXml(`${columnName(i + 1)}${r}`, cell))))
  })
  const lastDataRow = r

  if (sheet.notes && sheet.notes.length > 0) {
    r += 1 // отбивка от таблицы
    sheet.notes.forEach(note => {
      r += 1
      rows.push(rowXml(r, [`<c r="A${r}" s="${STYLE_NOTE}" t="inlineStr"><is><t xml:space="preserve">${xml(note)}</t></is></c>`]))
    })
  }

  const cols = sheet.widths
    .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
    .join('')

  // Закрепляем всё по шапку включительно: пролистав двести регистраций, важно
  // по-прежнему видеть, какой столбец чем является.
  const freeze = headRow > 0
    ? `<pane ySplit="${headRow}" topLeftCell="A${headRow + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>`
    : ''

  // Автофильтр вешаем только когда под шапкой есть хоть одна строка: на пустом
  // диапазоне Excel ругается на книгу.
  const filter = headRow > 0 && lastDataRow >= firstDataRow
    ? `<autoFilter ref="A${headRow}:${columnName(sheet.widths.length)}${lastDataRow}"/>`
    : ''

  // ⚠️ Порядок элементов внутри `worksheet` задан схемой, и переставить их
  // нельзя: `cols` строго перед `sheetData`, `autoFilter` строго после.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${freeze}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData>${filter}</worksheet>`
}

/**
 * Оформление книги.
 *
 * ⚠️ Номера в `cellXfs` — это и есть `STYLE_*` выше, по порядку с нуля.
 * Вставишь строку в середину — поедет всё оформление разом, и выяснится это
 * только глазами в Excel: ошибки не будет, просто даты станут числами.
 *
 * ⚠️ Нулевые `fonts`, `fills` и `borders` обязаны существовать, даже пустые, а
 * заливка номер один обязана быть именно `gray125`. Это не суеверие: Excel
 * считает первые две заливки служебными и без них объявляет книгу
 * повреждённой.
 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="DD.MM.YYYY"/><numFmt numFmtId="165" formatCode="#,##0.00&quot; ₼&quot;"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

/* ========================================================================== *
 *  ZIP
 * ========================================================================== */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** 1 января 2026 года в формате DOS. Прибито гвоздями ради одинаковых байтов — см. шапку файла. */
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1
const DOS_TIME = 0

interface ZipEntry {
  name: string
  bytes: Uint8Array
}

/**
 * Zip без сжатия.
 *
 * ⚠️ В флагах выставлен бит 11 (`0x0800`) — «имена в UTF-8». Все наши имена
 * внутри архива латиницей, так что практического следствия нет, но без флага
 * архив формально обещает кодировку MS-DOS, которой у нас нет.
 */
function zip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  entries.forEach(entry => {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.bytes)
    const size = entry.bytes.length

    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true) // нужна версия 2.0
    lv.setUint16(6, 0x0800, true) // имена в UTF-8
    lv.setUint16(8, 0, true) // метод 0 — без сжатия
    lv.setUint16(10, DOS_TIME, true)
    lv.setUint16(12, DOS_DATE, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)
    local.set(name, 30)

    const dir = new Uint8Array(46 + name.length)
    const dv = new DataView(dir.buffer)
    dv.setUint32(0, 0x02014b50, true)
    dv.setUint16(4, 20, true)
    dv.setUint16(6, 20, true)
    dv.setUint16(8, 0x0800, true)
    dv.setUint16(10, 0, true)
    dv.setUint16(12, DOS_TIME, true)
    dv.setUint16(14, DOS_DATE, true)
    dv.setUint32(16, crc, true)
    dv.setUint32(20, size, true)
    dv.setUint32(24, size, true)
    dv.setUint16(28, name.length, true)
    dv.setUint32(42, offset, true)
    dir.set(name, 46)

    parts.push(local, entry.bytes)
    central.push(dir)
    offset += local.length + size
  })

  const centralSize = central.reduce((sum, item) => sum + item.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const total = offset + centralSize + end.length
  const out = new Uint8Array(total)
  let at = 0
  ;[...parts, ...central, end].forEach(part => {
    out.set(part, at)
    at += part.length
  })
  return out
}

/* ========================================================================== *
 *  Книга
 * ========================================================================== */

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error('xlsx: книга без листов')

  const encoder = new TextEncoder()
  const taken = new Set<string>()
  const names = sheets.map(sheet => sheetName(sheet.name, taken))

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  }</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${
    names.map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
  }</sheets></workbook>`

  // Оформление идёт последней связью: её номер обязан не столкнуться с
  // номерами листов, а листов бывает разное число.
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
  }<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

  const entries: ZipEntry[] = [
    {name: '[Content_Types].xml', bytes: encoder.encode(contentTypes)},
    {name: '_rels/.rels', bytes: encoder.encode(rootRels)},
    {name: 'xl/workbook.xml', bytes: encoder.encode(workbook)},
    {name: 'xl/_rels/workbook.xml.rels', bytes: encoder.encode(workbookRels)},
    {name: 'xl/styles.xml', bytes: encoder.encode(STYLES_XML)},
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      bytes: encoder.encode(sheetXml(sheet))
    }))
  ]

  return zip(entries)
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function downloadXlsx(filename: string, bytes: Uint8Array): void {
  const blob = new Blob([bytes as BlobPart], {type: XLSX_TYPE})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // Ссылку надо положить в документ: Firefox не нажимает ту, что не в дереве.
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Иначе blob висит в памяти до перезагрузки страницы.
  URL.revokeObjectURL(url)
}
