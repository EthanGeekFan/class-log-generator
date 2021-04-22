#!/usr/bin/env node

const njk = require('nunjucks')
const fs = require('fs')
const inquirer = require('inquirer')
const ora = require('ora')
const path = require('path')
const cp = require('cli-progress')
const _ = require('lodash')
const parseName = require('./parseName')

const supportedImageFormats = [
    ".jpg",
    ".png",
    ".jpeg",
    ".HEIC",
    ".svg",
    ".bmp"
]

async function generateMarkdown() {
    njk.configure(path.join(__dirname, '../templates'), {autoescape: true})

    console.log(path.join(__dirname, '../templates'))
    const confQuestions = [
        {
            type: "input",
            name: "sourceDir",
            message: "Images source directory?",
            default: "./source"
        },
        {
            type: "input",
            name: "destDir",
            message: "Output directory?",
            default: "./output"
        }
    ]

    const conf = await inquirer.prompt(confQuestions)

    const sourceDir = conf['sourceDir']
    const destDir = conf['destDir']

    // validate paths:
    if (!fs.existsSync(sourceDir)) {
        // Path not valid
        console.log('Source directory does not exist, please check and try again.')
        process.exit(0)
    }
    if (!fs.existsSync(destDir)) {
        // Path not exists
        let spinner = ora({text: `Creating output directory at ${destDir}`}).start()
        try {
            fs.mkdirSync(destDir, {recursive: true})
            spinner.succeed("Directory Created Successfully")
        } catch (e) {
            spinner.fail(`Failed creating directory ${destDir}`)
        }
    }

    let dir = fs.readdirSync(sourceDir)

    let files = []
    // filter images:
    for (let i = 0; i < dir.length; i++) {
        if (supportedImageFormats.includes(path.extname(dir[i]))) {
            files.push(dir[i])
        }
    }

    files = _.filter(files, (file) => parseName(file).valid)

    // console.log(`Total images: ${files.length}`)
    if (!(await inquirer.prompt([
        {
            type: "confirm",
            name: "continue",
            message: `${files.length} images to process, are you sure to continue?`,
            default: true
        }
        ]))['continue']) {
        console.log("Abort!")
        process.exit(0)
    }

    const progress = new cp.SingleBar({
        format: "Generating {bar} {percentage}% | Duration: {duration}s",
        stopOnComplete: true,
        fps: 60,
        position: 'center',
    }, cp.Presets.shades_classic)
    progress.start(files.length, 0)
    let invalidCount = 0
    let overwritten = []
    for (let i = 0; i < files.length; i++) {
        const filename = files[i]
        const { valid, date, author } = parseName(filename)
        if (!valid) {
            invalidCount += 1
            progress.increment();
            continue;
        }
        const mdname = `Log-${date}.md`
        const url = `https://cdn.jsdelivr.net/gh/EthanGeekFan/OurMemories-ImgHosting/img/Log-${date}/${filename}`
        const ctx = {
            author: author,
            date: date,
            url: url
        }
        const savePath = path.join(destDir, mdname)
        const res = njk.render('classlog.md.njk', ctx)
        if (fs.existsSync(savePath)) {
            // const answers = await inquirer.prompt([
            //     {
            //         type: "confirm",
            //         name: "overwrite",
            //         message: `File ${filename} already exists, are you sure to overwrite it?`,
            //         default: true
            //     }
            // ])
            // if (!answers['overwrite']) {
            //     progress.increment();
            //     continue;
            // }
            overwritten.push(savePath)
        }
        fs.writeFileSync(savePath, res, {})
        progress.increment();
    }
    progress.stop()
    console.log(`Generation Completed!`)
    console.log(`${invalidCount} invalid images`)
    console.log(`Overwrote ${overwritten.length} output files:`)
    for (let i = 0; i < overwritten.length; i++) {
        console.log(path.resolve(overwritten[i]))
    }
    console.log("Have a nice day! ")
}

module.exports = generateMarkdown