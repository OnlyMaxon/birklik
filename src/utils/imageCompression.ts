export async function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.82
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

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
      if (!ctx) return reject(new Error('Canvas unavailable'))

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'))
          const newName = file.name.replace(/\.[^.]+$/, '.webp')
          resolve(new File([blob], newName, { type: 'image/webp' }))
        },
        'image/webp',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image load failed'))
    }

    img.src = objectUrl
  })
}

export async function compressPropertyImage(file: File): Promise<File> {
  return compressImage(file, 1200, 900, 0.82)
}

export async function compressAvatarImage(file: File): Promise<File> {
  return compressImage(file, 400, 400, 0.85)
}
