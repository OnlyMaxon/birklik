const BLOB_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png'
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function applyWatermark(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, canvasW: number, canvasH: number): void {
  // Логотип занимает 35% ширины, но не более 280px
  const logoW = Math.min(canvasW * 0.35, 280)
  const logoH = logoW * (logo.height / logo.width)
  const x = (canvasW - logoW) / 2
  const y = (canvasH - logoH) / 2

  ctx.save()
  ctx.globalAlpha = 0.20
  ctx.drawImage(logo, x, y, logoW, logoH)
  ctx.restore()
}

export async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.82,
  watermark = false
): Promise<File> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const img = await loadImage(objectUrl)

    let { width, height } = img
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')

    ctx.drawImage(img, 0, 0, width, height)

    if (watermark) {
      try {
        const logo = await loadImage('/brand/generated/logo-512x128.png')
        applyWatermark(ctx, logo, width, height)
      } catch {
        // Не удалось загрузить логотип — продолжаем без watermark
      }
    }

    // Браузер, не умеющий кодировать webp в canvas, по спецификации молча
    // отдаёт PNG и игнорирует quality. Раньше результат всё равно называли
    // .webp — так в Storage попадали PNG по 1–2 МБ вместо webp по 60 КБ.
    // Смотрим фактический тип и при отказе переснимаем в jpeg: его умеют все.
    let blob = await canvasToBlob(canvas, 'image/webp', quality)
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    }
    if (!blob) throw new Error('Compression failed')

    // Имя и тип всегда соответствуют содержимому, чем бы браузер ни ответил.
    const extension = BLOB_EXTENSIONS[blob.type] ?? 'png'
    const newName = file.name.replace(/\.[^.]+$/, `.${extension}`)
    return new File([blob], newName, { type: blob.type })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function compressPropertyImage(file: File): Promise<File> {
  return compressImage(file, 900, 675, 0.75, true)
}

export async function compressAvatarImage(file: File): Promise<File> {
  return compressImage(file, 400, 400, 0.85)
}
