'use strict'
const path = require('node:path')
const fs = require('node:fs')
const chalk = require('chalk')
const pckg = require('../package')

const version = pckg.version
const distDir = path.resolve(__dirname, '../dist/static')
const publicDir = path.resolve(__dirname, '../../public')

const files = [
  {
    src: path.join(distDir, `js/qiscus-sdk.${version}.js`),
    dst: path.join(publicDir, `js/qiscus-sdk.${version}.js`)
  },
  {
    src: path.join(distDir, `js/qiscus-sdk.${version}.js.map`),
    dst: path.join(publicDir, `js/qiscus-sdk.${version}.js.map`)
  },
  {
    src: path.join(distDir, `css/qiscus-sdk.${version}.css`),
    dst: path.join(publicDir, `css/qiscus-sdk.${version}.css`)
  }
]

console.log(chalk.cyan('  Copying build artifacts to public folder...\n'))

let copied = 0
files.forEach(file => {
  try {
    if (!fs.existsSync(file.src)) {
      console.log(chalk.yellow(`  ⚠ Source file not found: ${file.src}`))
      return
    }

    fs.copyFileSync(file.src, file.dst)
    copied++
    console.log(chalk.green(`  ✓ ${path.relative(publicDir, file.dst)}`))
  } catch (err) {
    console.log(chalk.red(`  ✗ Failed to copy ${file.src}: ${err.message}`))
    process.exit(1)
  }
})

if (copied > 0) {
  console.log(chalk.cyan(`\n  ${copied} file(s) copied successfully.\n`))
} else {
  console.log(chalk.red('\n  No files copied.\n'))
  process.exit(1)
}
