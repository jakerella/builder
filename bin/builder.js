#! /usr/bin/env node

const start = Date.now()

const fs = require('fs-extra')
const path = require('path')
const Handlebars = require('handlebars')

const DEFAULT_CONFIG_FILENAME = 'build.json'

const logger = createLogger()

; (() => {
    const options = checkOptions(Array.from(process.argv).slice(2))

    logger.info('Starting build...')

    if (options.clean) {
        logger.log('Cleaning previous build...')
        fs.rmSync(options.destination, { recursive: true, force: true })
        logger.debug(`Removed previous build folder: ${options.destination}`)
    } else {
        logger.debug(`Skipping clean step`)
    }

    const templates = buildTemplates(options)
    logger.info(`Parsed ${Object.keys(templates).length} templates for use: ${Object.keys(templates)}`)

    fs.mkdirSync(options.destination)
    logger.log(`Created new build directory at: ${options.destination}`)

    const pages = gatherPageData(options)
    for (let name in pages) {
        const result = templates[pages[name].layout || options.default_layout]({ ...pages[name].metadata, contents: pages[name].contents })
        logger.debug(`Generated page (${name}) from template (${pages[name].layout || options.default_layout})`)
        fs.writeFileSync(`${options.destination}/${name}.html`, result)
        logger.debug(`Wrote page contents to: ${options.destination}/${name}.html`)
    }

    ;(options.static_copy || []).forEach(loc => {
        const dest = path.join(options.destination, loc.dest)
        logger.debug(`copying ${loc.source} to ${dest}`)
        fs.copySync(loc.source, dest)
    })
    logger.info(`Copied static assets to ${options.destination}`)

    reportCompletion()
})()


// ---------------------- HELPERS ---------------------- //

function checkOptions(args = []) {
    let options = {}
    const optionsFilename = args.length ? args[0] : DEFAULT_CONFIG_FILENAME

    try {
        logger.debug(`Reading options from file: ${optionsFilename}`)
        options = JSON.parse(fs.readFileSync(optionsFilename))
    } catch (err) {
        logger.warn(`Unable to read options from file: ${optionsFilename}`)
    }

    // All the defaults
    options = {
        destination: 'build/',
        clean: true,
        default_layout: 'basic',
        layouts_loc: 'layouts/',
        partials_loc: 'layouts/partials/',
        pages_loc: 'pages/',
        ...options
    }

    logger.debug('Using options:', JSON.stringify(options, null, 2))

    return options
}

function buildTemplates(options) {
    const partials = gatherFilesFromDir(options.partials_loc, 'partial')
    const partialContent = {}
    Object.keys(partials).map(name => { partialContent[name] = partials[name].content })
    Handlebars.registerPartial(partialContent)
    logger.debug(`Registered ${Object.keys(partials).length} partials with Handlebars`)

    const layouts = gatherFilesFromDir(options.layouts_loc, 'layout')
    const templates = {}
    for (let name in layouts) {
        templates[name] = Handlebars.compile(layouts[name].content)
        logger.debug(`Compiled ${name} template from layout file`)
    }
    logger.log(`Compiled ${Object.keys(templates).length} layout templates`)
    return templates
}

function gatherPageData(options) {
    const pages = {}
    const pageFiles = gatherFilesFromDir(options.pages_loc, 'page')
    for (let name in pageFiles) {
        if (pageFiles[name].content.indexOf('---') !== 0 || pageFiles[name].content.indexOf('---', 4) < 0) {
            logger.warn(`Skipping page file with bad or missing metadata: ${name}`)
            continue
        }
        const pageParts = pageFiles[name].content.split('---')
        const metaLines = pageParts[1].split(/\n/).slice(1, -1)
        const metadata = {}
        metaLines.forEach((line) => {
            const data = line.split(':')
            metadata[data[0]] = data[1].trim()
        })
        logger.debug(`Parsed metadata for: ${name}: ${JSON.stringify(metadata)}`)
        pages[name] = {
            contents: pageParts[2],
            metadata,
            sourceLoc: path.join(options.pages_loc, `${name}.${pageFiles[name].ext}`)
        }
    }
    logger.info(`Parsed ${Object.keys(pages).length} pages for processing`)
    return pages
}

function gatherFilesFromDir(dir, type) {
    logger.debug(`Looking for ${type} files at: ${dir}`)
    const files = {}
    fs.readdirSync(dir, { withFileTypes: true }).forEach((f) => {
        if (!f.isFile()) {
            return logger.debug(`Skipping non-file ${type} entry: ${f.name}`)
        }
        const filename = f.name
        try {
            const name = filename.split('.').slice(0, -1).join('.')
            files[name] = { ext: filename.split('.').pop(), content: fs.readFileSync(path.join(dir, filename)).toString() }
        } catch (err) {
            return logger.warn(`Unable to read ${type} file: ${filename}`)
        }
        logger.debug(`Found ${type}: ${filename}`)
    })
    logger.log(`Found ${Object.keys(files).length} ${type} entries`)
    return files
}

function reportCompletion() {
    let units = 'ms'
    let diff = Date.now() - start
    if (diff > 1000) {
        diff = Math.round((Date.now() - start) / 100) / 10
        units = 's'
    }

    logger.info(`Finished build in ${diff}${units}`)
}

// ---------------- Logging Helper ------------------ //

function createLogger(opts = {}) {
    const LEVELS = {
        DEBUG: 5,
        LOG: 4,
        INFO: 3,
        WARN: 2,
        ERROR: 1,
        OFF: 0
    }
    const DEFAULT_LEVEL = 'INFO'
    const DEFAULT_MESSAGE_LEVEL = 'LOG'
    const LOG_METHDOS = [null, 'error', 'warn', 'info', 'log', 'debug']
    const COLORS = {
        DEBUG: '\x1b[36m',
        LOG: '\x1b[37m',
        INFO: '\x1b[34m',
        WARN: '\x1b[33m',
        ERROR: '\x1b[31m',
        RESET: '\x1b[0m'
    }

    const loggerLevel = (LEVELS[opts.level] === undefined) ? (process.env.DEBUG_LEVEL || DEFAULT_LEVEL) : opts.level

    if (loggerLevel === 'DEBUG') {
        console.debug(`${COLORS.DEBUG}Creating logger with level ${loggerLevel}${COLORS.RESET}`)
    }

    function writeLog(level, args) {
        level = (LEVELS[level] === undefined) ? DEFAULT_MESSAGE_LEVEL : level
        args = (args.splice) ? args : [args]

        if (LEVELS[loggerLevel] < LEVELS[level]) { return }

        const message = [COLORS[level], args[0]]

        if (args.length > 1) {
            args.slice(1).forEach((a) => {
                if (typeof (a) === 'object') {
                    message.push('\n')
                    message.push(JSON.stringify(a))
                    message.push('\n')
                } else {
                    message.push(a)
                }
            })
        }

        message.push(COLORS.RESET)

        console[LOG_METHDOS[LEVELS[level]]].apply(console, [message.join(' ')])
    }

    const loggerInstance = function () {
        writeLog('LOG', Array.from(arguments))
    }
    loggerInstance.debug = function () { writeLog('DEBUG', Array.from(arguments)) }
    loggerInstance.log = function () { writeLog('LOG', Array.from(arguments)) }
    loggerInstance.info = function () { writeLog('INFO', Array.from(arguments)) }
    loggerInstance.warn = function () { writeLog('WARN', Array.from(arguments)) }
    loggerInstance.error = function () { writeLog('ERROR', Array.from(arguments)) }

    return loggerInstance
}
