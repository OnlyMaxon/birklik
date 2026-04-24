import fs from 'fs'
import path from 'path'

// Copy dist/index.html to dist/404.html
const distDir = './dist'
const indexPath = path.join(distDir, 'index.html')
const notFoundPath = path.join(distDir, '404.html')

try {
  if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, notFoundPath)
    console.log('✅ Successfully copied dist/index.html → dist/404.html')
  } else {
    console.error('❌ dist/index.html not found')
    process.exit(1)
  }
} catch (err) {
  console.error('❌ Error copying 404.html:', err)
  process.exit(1)
}
