import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const input = path.join(rootDir, 'public', 'brand', 'logo-source.png')
const outputDir = path.join(rootDir, 'public', 'brand', 'generated')

const horizontalSizes = [
  { width: 512, height: 128, name: 'logo-512x128.png' },
  { width: 1024, height: 256, name: 'logo-1024x256.png' },
  { width: 256, height: 64, name: 'logo-256x64.png' }
]

const squareSizes = [512, 256, 192, 180, 128, 96, 64, 32, 16]

async function run() {
  await mkdir(outputDir, { recursive: true })

  // Trim transparent borders first so the logo occupies output space.
  const trimmedSource = await sharp(input)
    .trim()
    .toBuffer()

  const metadata = await sharp(trimmedSource).metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not read source image dimensions')
  }

  for (const size of horizontalSizes) {
    await sharp(trimmedSource)
      .resize(size.width, size.height, { fit: 'contain', background: '#ffffff00' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputDir, size.name))
  }

  for (const size of squareSizes) {
    await sharp(trimmedSource)
      .resize(size, size, { fit: 'contain', background: '#ffffff00' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputDir, `logo-${size}x${size}.png`))
  }

  await sharp(trimmedSource)
    .resize(512, 512, { fit: 'contain', background: '#ffffff00' })
    .webp({ quality: 90 })
    .toFile(path.join(outputDir, 'logo-512x512.webp'))

  await sharp(trimmedSource)
    .resize(1024, 256, { fit: 'contain', background: '#ffffff00' })
    .webp({ quality: 90 })
    .toFile(path.join(outputDir, 'logo-1024x256.webp'))

  console.log('Logo assets generated in public/brand/generated')
}

run().catch((error) => {
  console.error('Failed to generate logo assets:', error)
  process.exitCode = 1
})
