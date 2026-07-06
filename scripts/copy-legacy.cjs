const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const legacySourceDir = path.join(rootDir, 'legacy-src')
const legacyDistDir = path.join(distDir, 'legacy')

if (!fs.existsSync(distDir)) {
  throw new Error('Build output directory was not found. Run vite build before copying legacy pages.')
}

fs.rmSync(legacyDistDir, { recursive: true, force: true })
fs.cpSync(legacySourceDir, legacyDistDir, { recursive: true })

for (const assetName of ['ASG Tech Stamp without background.png', 'icon.svg']) {
  const sourcePath = path.join(rootDir, assetName)
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, path.join(legacyDistDir, assetName))
  }
}

console.log('Copied classic ASG Tech pages to dist/legacy')
