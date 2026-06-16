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

    return await new Promise<File>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'))
          const newName = file.name.replace(/\.[^.]+$/, '.webp')
          resolve(new File([blob], newName, { type: 'image/webp' }))
        },
        'image/webp',
        quality
      )
    })
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
