#!/usr/bin/env node

const shell = require('shelljs')
const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const os = require('os')
const _ = require('lodash')
const parseName = require('./parseName')
const ora = require("ora");
const util = require("util");
const chalk = require('chalk')

const supportedImageFormats = [
    ".jpg",
    ".png",
    ".jpeg",
    ".HEIC",
    ".svg",
    ".bmp"
]

async function uploadImages() {
    const homedir = os.homedir()
    const confQuestions = [
        {
            type: "input",
            name: "sourceDir",
            message: "Images source directory?",
            default: "./source"
        },
        {
            type: "input",
            name: "repo",
            message: "Local GitHub image hosting repo?",
            default: path.join(homedir, 'Documents/AppDev/OurMemories-ImgHosting')
        },
        {
            type: "input",
            name: "imgDir",
            message: "Image directory in repo?",
            default: "img/"
        }
    ]
    const conf = await inquirer.prompt(confQuestions)
    const { sourceDir, repo, imgDir } = conf
    const destDir = path.join(repo, imgDir)
    if (!fs.existsSync(repo)) {
        console.log('Repo does not exists!')
        process.exit(0)
    }
    // validate paths:
    if (!fs.existsSync(sourceDir)) {
        // Source Path not valid
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
    // copy files
    files.forEach(function (f, index, array) {
        const { valid, date } = parseName(f)
        if (valid) {
            const folder = `Log-${date}`
            if (!fs.existsSync(path.join(destDir, folder))) {
                fs.mkdirSync(path.join(destDir, folder))
            }
            shell.cp(path.join(sourceDir, f), path.join(destDir, folder))
        }
    })
    // validate repo and commit
    if (!checkRepo(repo)) {
        console.log('Invalid Repo!')
        process.exit()
    }
    shell.cd(repo)
    let { code } = shell.exec('git add --all')
    if (code !== 0) {
        console.log("Git add error. Please solve the problem.")
        process.exit(0)
    }
    console.log('Changes staged')
    code = shell.exec('git commit -am "Auto Update Images"').code
    // if (code !== 0) {
    //     console.log("Git add error. Please solve the problem.")
    //     process.exit(0)
    // }
    await pushChanges(repo)
}

function checkRepo(repo) {
    if (!shell.which('git')) {
        shell.echo('Sorry, this script requires git');
        shell.exit(1);
    }
    let valid = true
    if (!fs.existsSync(repo)) {
        valid = false
        return valid
    }
    if (!fs.existsSync(path.join(repo, '.git'))) {
        valid = false
        return valid
    }
    return valid
}

async function pushChanges(repo) {
    shell.cd(repo)
    let {code, stdout, stderr} = shell.exec('git remote -v', {silent: true})
    if (code !== 0) {
        console.log(`Git command error: ${stderr}`)
        return;
    }
    const urlPattern = /\b\w+\s*(?<url>\b[\w-_.:@/%]+\.git\b)\s*\((?<type>[a-z]+)\)/g;
    const detailPattern = /(?<name>\w+)\s*(https?:\/\/|[a-z]+)@?(?<host>\w+\.\w+)[:\/].*\((?<type>[a-z]+)\)/g;
    let remotes = stdout.trim().split('\n')
    let githubs = {}
    for (let remote of remotes) {
        const res = detailPattern.exec(remote)
        if (res === null) {
            continue
        } else {
            if (res.groups.host === "github.com") {
                const s = urlPattern.exec(remote)
                if (!s) {
                    continue
                }
                const {url} = s.groups
                githubs[res.groups.name] = url
            }
        }
    }
    if (Object.keys(githubs).length === 0) {
        console.log("No GitHub remote added. Skipping push...")
        return;
    }
    let useRemote = Object.keys(githubs)[0]
    if (Object.keys(githubs).length > 1) {
        const choices = Object.keys(githubs)
        const ans = inquirer.prompt([
            {
                type: "list",
                name: "gitRemote",
                message: "Choose a remote to push your commit:",
                choices: choices,
            }
        ])
        useRemote = ans['gitRemote']
    }
    let spinner = ora({text: `Pushing commits to remote: ${chalk.blue(useRemote)}`}).start()
    const pushPromise = util.promisify(shell.exec)
    try {
        await pushPromise(`git push ${useRemote}`, {async: true, silent: true}, function (c, o, e) {
            spinner.succeed(`${chalk.green('Successfully pushed to remote')} ${chalk.blue(useRemote)}`)
            let mes = ""
            if (o) {
                console.log(o)
                mes = o
            } else {
                console.log(e)
                mes = e
            }
            if (mes.match(/.*Everything up-to-date.*/g)) {
                ora(chalk.green('Already the latest version, skipped release!')).succeed()
            } else {
                release(repo, useRemote)
            }
        })

    } catch (e) {
        spinner.fail("Push failed")
    } finally {

    }
}

async function release(repo, remote) {
    shell.cd(repo)
    const tags = shell.exec('git tag -l', {silent: true}).stdout.trim().split('\n')
    let latest = 'v0.1.0'
    if (tags.length > 0) {
        latest = tags[tags.length - 1]
    }
    let latestComp = latest.split('.')
    latestComp[latestComp.length - 1] = (parseInt(latestComp[latestComp.length - 1]) + 1).toString()
    let newVersion = latestComp.join('.')
    shell.exec(`git tag ${newVersion}`)
    let spinner = ora({text: `Pushing ${newVersion} release to remote: ${chalk.blue(remote)}`}).start()
    const pushPromise = util.promisify(shell.exec)
    try {
        await pushPromise(`git push ${remote} ${newVersion}`, {async: true, silent: true}, function (c, o, e) {
            spinner.succeed(`${chalk.green(`Successfully pushed ${chalk.blue(newVersion)} to remote`)} ${chalk.blue(remote)}`)
            if (o) {
                console.log(o)
            } else {
                console.log(e)
            }
        })
    } catch (e) {
        spinner.fail("Push failed")
    }
}

module.exports = uploadImages