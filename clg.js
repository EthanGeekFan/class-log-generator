#!/usr/bin/env node

const { program } = require('commander')
const packageJson = require('./package.json')

const markdown = require('./lib/markdown')
const upload = require('./lib/upload')
const shell = require('shelljs')

// const program = new cmd.Command("Class Log Generator")

program
    .command('gen')
    .description("Generate Markdown files from source images")
    .action(markdown)

program
    .command('upload')
    .description("Upload images to GitHub Image Hosting repository")
    .action(upload)

// program.action(function () {
//     console.log(program.helpInformation())
// })

program
    .version(packageJson.version, '-v, --version')

program.parse(process.argv)


