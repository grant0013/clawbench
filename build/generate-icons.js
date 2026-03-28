const sharp = require('sharp')
const toIco = require('to-ico')
const fs = require('fs')
const path = require('path')

const svgPath  = path.join(__dirname, 'icon.svg')
const buildDir = __dirname

async function run() {
  console.log('Reading SVG...')
  const svg = fs.readFileSync(svgPath)

  // Generate PNGs at every required size
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
  const pngPaths = {}

  for (const size of sizes) {
    const outPath = path.join(buildDir, `icon-${size}.png`)
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outPath)
    pngPaths[size] = outPath
    console.log(`  ✓ icon-${size}.png`)
  }

  // Copy 512px as main icon.png (used by electron-builder for Linux)
  fs.copyFileSync(pngPaths[512], path.join(buildDir, 'icon.png'))
  console.log('  ✓ icon.png (512px)')

  // Build icon.ico from 16, 24, 32, 48, 64, 128, 256 px
  console.log('Building icon.ico...')
  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const icoBuffers = icoSizes.map(s => fs.readFileSync(pngPaths[s]))
  const icoBuffer = await toIco(icoBuffers)
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer)
  console.log('  ✓ icon.ico (16/24/32/48/64/128/256px)')

  // Clean up individual PNGs
  for (const size of sizes) {
    if (size !== 512) fs.unlinkSync(pngPaths[size])
  }

  console.log('\nAll icons generated in build/')
  console.log('  build/icon.svg  — source')
  console.log('  build/icon.png  — 512px PNG (Linux)')
  console.log('  build/icon.ico  — multi-size ICO (Windows)')
}

run().catch(err => { console.error(err); process.exit(1) })
