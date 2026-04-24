import fs from 'fs'
import path from 'path'

// Remove dist/404.html so that _redirects rules take precedence
// Cloudflare Pages checks for 404.html before applying _redirects rules
// By removing 404.html, we force Cloudflare to use the _redirects SPA routing rule
const distDir = './dist'
const notFoundPath = path.join(distDir, '404.html')

try {
  if (fs.existsSync(notFoundPath)) {
    fs.unlinkSync(notFoundPath)
    console.log('✅ Removed dist/404.html - _redirects rule will be used for SPA routing')
  }
} catch (err) {
  console.error('❌ Error removing 404.html:', err)
  process.exit(1)
}

