/**
 * Выгрузка отчёта таблицей, которую открывает Excel.
 *
 * Это CSV, а не настоящий `.xlsx`, и причина не в лени: xlsx — это zip с
 * несколькими XML внутри, собрать его можно только библиотекой, а сайт живёт
 * на Cloudflare Workers, где лишний вес кода платится на каждом ответе. Такой
 * файл открывается двойным щелчком в Excel, в Numbers и в Google Sheets.
 *
 * ⚠️ **Разделитель — точка с запятой, и первой строкой идёт `sep=;`.** Excel на
 * русской и азербайджанской Windows считает запятую десятичным знаком: файл с
 * запятыми лёг бы одним столбцом. `sep=;` — указание самому Excel, он его
 * читает и раскладывает правильно. В Google Sheets первая строка видна как
 * ячейка `sep=;` — это цена за то, чтобы у владельца открылось сразу.
 *
 * ⚠️ **BOM обязателен.** Без него Excel читает UTF-8 как ANSI, и вместо имён
 * получается каша.
 */

const DELIMITER = ';'

/** Поле. Кавычки, перевод строки и сам разделитель ломают разбор — такое берём в кавычки. */
const cell = (value: string | number | undefined | null): string => {
  const text = value === undefined || value === null ? '' : String(value)
  return /["\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Число для Excel: дробная часть через ЗАПЯТУЮ.
 *
 * Той же причины, что и `sep=;`: с точкой русский Excel принял бы `16.83` за
 * текст или за дату, и столбец сумм перестал бы складываться. Целые пишем без
 * дробной части — манатные цены все целые, и `55,00` рядом с ценой «55 ₼»
 * читалось бы как другая сумма.
 */
export const csvNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')

export interface CsvSection {
  title: string
  head: string[]
  rows: (string | number)[][]
}

/** Разделы идут друг за другом, через пустую строку: один файл — весь отчёт. */
export function buildCsv(sections: CsvSection[]): string {
  const lines: string[] = ['sep=;']
  sections.forEach((section, index) => {
    if (index > 0) lines.push('')
    lines.push(cell(section.title))
    if (section.head.length > 0) lines.push(section.head.map(cell).join(DELIMITER))
    section.rows.forEach(row => lines.push(row.map(cell).join(DELIMITER)))
  })
  // CRLF: с одними переводами строки Excel склеивает строки в одну.
  return lines.join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], {type: 'text/csv;charset=utf-8'})
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
