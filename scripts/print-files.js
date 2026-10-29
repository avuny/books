#!/usr/bin/env node
"use strict"

const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

// Don't crash when output is piped into something like `head`.
process.stdout.on("error", (err) => {
    if (err.code !== "EPIPE") throw err
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALWAYS_SKIP = new Set(["node_modules", ".git"])
const DEFAULT_MAX_SIZE = 256 * 1024 // 256 KB
const SNIFF_BYTES = 8000
const SEPARATOR = "=".repeat(50)

const BINARY_EXTENSIONS = new Set([
    // images
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico", ".icns", ".tif", ".tiff", ".heic", ".psd",
    // fonts
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    // audio / video
    ".mp3", ".wav", ".flac", ".ogg", ".mp4", ".mov", ".avi", ".mkv", ".webm",
    // archives
    ".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar",
    // documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    // compiled / databases
    ".exe", ".dll", ".so", ".dylib", ".bin", ".class", ".jar", ".wasm", ".pyc", ".o", ".a",
    ".sqlite", ".sqlite3", ".db",
])

const LOCKFILES = new Set([
    "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml",
    "bun.lock", "bun.lockb", "composer.lock", "Gemfile.lock", "poetry.lock",
    "Pipfile.lock", "Cargo.lock", "go.sum",
])
const GENERATED_SUFFIXES = [".min.js", ".min.css", ".map"]

const HELP = `
Print Nested Files - CLI Utility

Usage:
  node printFiles.js [directory] [options]
  node printFiles.js [directory] [include] [exclude]     (legacy positional form)

Recursively prints the contents of every text file under a directory, each one
preceded by a header with its path, with a directory tree at the top.
Paths are shown relative to the project root: the git root if there is one,
otherwise the current directory (when scanning inside it), otherwise the
scanned directory itself.
Output goes to stdout unless --out or --copy is used. Status and the summary
always go to stderr, so piped output stays clean.

Options:
  -i, --include <patterns>   Only print matching files (comma-separated, repeatable)
  -e, --exclude <patterns>   Skip matching files and folders (comma-separated, repeatable)
  -d, --depth <n>            Max subfolder levels to descend (0 = top level only)
  -o, --out <file>           Write the output to a file
  -c, --copy                 Copy the output to the clipboard
  -n, --line-numbers         Prefix every line with its line number
  -t, --tokens               Show line count and approx. tokens in each file header
      --max-size <size>      Skip files larger than this (default 256kb, 0 = no limit)
      --no-tree              Omit the directory tree header
      --no-gitignore         Don't read .gitignore files
      --keep-generated       Include lockfiles, minified files and source maps
      --include-env          Include .env files (skipped by default, may hold secrets)
  -v, --verbose              List every skipped path and the reason
  -h, --help                 Show this help and exit

Patterns:
  .ts             plain text matches the end of a file name (".ts", "-lock.json")
  src/utils       a plain path matches that file or folder
  *.test.*        globs without "/" match file names at any depth
  src/**/*.ts     globs with "/" match the path from the scanned directory
  dist/           a trailing "/" matches folders only

Always skipped:
  node_modules, .git, symlinks, binary files, and anything matched by .gitignore
  (root, nested, and parent .gitignore files up to the git root).

Examples:
  node printFiles.js .
  node printFiles.js ./src -i .ts,.tsx -e "*.test.*"
  node printFiles.js . -d 2 --out all.txt
  node printFiles.js ./src -i .js -n -t --copy
  node printFiles.js ./src .js .test.js
`

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const FLAGS = {
    "-h": "help", "--help": "help",
    "-i": "include", "--include": "include",
    "-e": "exclude", "--exclude": "exclude",
    "-d": "depth", "--depth": "depth",
    "-o": "out", "--out": "out",
    "--max-size": "maxSize",
    "-c": "copy", "--copy": "copy",
    "-n": "lineNumbers", "--line-numbers": "lineNumbers",
    "-t": "tokens", "--tokens": "tokens",
    "-v": "verbose", "--verbose": "verbose",
    "--no-tree": "noTree",
    "--no-gitignore": "noGitignore",
    "--keep-generated": "keepGenerated",
    "--include-env": "includeEnv",
}
const VALUE_FLAGS = new Set(["include", "exclude", "depth", "out", "maxSize"])

function splitList(value) {
    return value.split(",").map((s) => s.trim()).filter(Boolean)
}

function parseSize(value) {
    const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(value.trim())
    if (!match) throw new Error(`Invalid size "${value}" (try 200kb or 1mb)`)
    const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }
    const bytes = Math.floor(parseFloat(match[1]) * units[(match[2] || "kb").toLowerCase()])
    return bytes === 0 ? Infinity : bytes
}

function parseArgs(argv) {
    const opts = {
        dir: ".",
        include: [],
        exclude: [],
        depth: Infinity,
        out: null,
        copy: false,
        maxSize: DEFAULT_MAX_SIZE,
        gitignore: true,
        tree: true,
        lineNumbers: false,
        tokens: false,
        keepGenerated: false,
        includeEnv: false,
        verbose: false,
        help: false,
    }
    const positional = []

    for (let i = 0; i < argv.length; i++) {
        let arg = argv[i]

        if (arg === "--") {
            positional.push(...argv.slice(i + 1))
            break
        }
        if (!arg.startsWith("-") || arg === "-") {
            positional.push(arg)
            continue
        }

        let value = null
        const eq = arg.indexOf("=")
        if (arg.startsWith("--") && eq !== -1) {
            value = arg.slice(eq + 1)
            arg = arg.slice(0, eq)
        }

        const key = FLAGS[arg]
        if (!key) throw new Error(`Unknown option: ${arg}`)

        if (VALUE_FLAGS.has(key)) {
            if (value === null) value = argv[++i]
            if (value === undefined) throw new Error(`Option ${arg} requires a value`)
        } else if (value !== null) {
            throw new Error(`Option ${arg} does not take a value`)
        }

        switch (key) {
            case "include":
                opts.include.push(...splitList(value))
                break
            case "exclude":
                opts.exclude.push(...splitList(value))
                break
            case "depth": {
                const n = Number(value)
                if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid depth "${value}" (use a whole number >= 0)`)
                opts.depth = n
                break
            }
            case "out":
                opts.out = value
                break
            case "maxSize":
                opts.maxSize = parseSize(value)
                break
            case "noTree":
                opts.tree = false
                break
            case "noGitignore":
                opts.gitignore = false
                break
            default:
                opts[key] = true
        }
    }

    if (positional.length > 3) throw new Error("Too many positional arguments")
    if (positional[0]) opts.dir = positional[0]
    if (positional[1]) opts.include.push(...splitList(positional[1]))
    if (positional[2]) opts.exclude.push(...splitList(positional[2]))

    return opts
}

// ---------------------------------------------------------------------------
// Glob + pattern helpers
// ---------------------------------------------------------------------------

const toPosix = (p) => p.split(path.sep).join("/")
const escapeRegex = (ch) => ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")

/**
 * Converts a glob into a regex source string.
 * Supports *, ?, [abc], [!abc], and ** (including the star-star-slash form).
 */
function globToRegexSource(glob) {
    let re = ""
    let i = 0
    while (i < glob.length) {
        const c = glob[i]
        if (c === "*") {
            if (glob[i + 1] === "*") {
                const atSegmentStart = i === 0 || glob[i - 1] === "/"
                if (atSegmentStart && glob[i + 2] === "/") {
                    re += "(?:.*/)?"
                    i += 3
                    continue
                }
                if (atSegmentStart && i + 2 === glob.length) {
                    re += ".*"
                    i += 2
                    continue
                }
                while (glob[i] === "*") i++
                re += "[^/]*"
                continue
            }
            re += "[^/]*"
            i++
        } else if (c === "?") {
            re += "[^/]"
            i++
        } else if (c === "[") {
            const end = glob.indexOf("]", i + 2)
            if (end === -1) {
                re += "\\["
                i++
            } else {
                let body = glob.slice(i + 1, end).replace(/\\/g, "\\\\")
                if (body[0] === "!") body = "^" + body.slice(1)
                re += "[" + body + "]"
                i = end + 1
            }
        } else if (c === "\\" && i + 1 < glob.length) {
            re += escapeRegex(glob[i + 1])
            i += 2
        } else {
            re += escapeRegex(c)
            i++
        }
    }
    return re
}

/**
 * Compiles an --include / --exclude pattern into a matcher function.
 * Matchers receive { rel, name, isDir } where rel is the posix path from the scanned root.
 */
function compileCliPattern(raw) {
    let p = raw.replace(/\\/g, "/").replace(/^\.\//, "")
    const dirOnly = p.endsWith("/")
    p = p.replace(/\/+$/, "")
    if (!p) return () => false

    // Plain text: suffix of the file name, or an exact path / folder prefix.
    if (!/[*?[]/.test(p)) {
        return ({ rel, name, isDir }) => {
            const underneath = rel.startsWith(p + "/")
            if (dirOnly) return (isDir && (name === p || rel === p)) || underneath
            return name.endsWith(p) || rel === p || underneath
        }
    }

    // Glob: no "/" -> match the file name anywhere; with "/" -> match from the root.
    const hasSlash = p.includes("/")
    const re = new RegExp("^" + globToRegexSource(p.replace(/^\//, "")) + "$")
    return ({ rel, name, isDir }) => {
        if (dirOnly && !isDir) return false
        if (!hasSlash) return re.test(name)
        return re.test(rel) || (isDir && re.test(rel + "/"))
    }
}

// ---------------------------------------------------------------------------
// .gitignore support
// ---------------------------------------------------------------------------

function parseGitignore(content, baseDir) {
    const rules = []
    for (let line of content.split(/\r?\n/)) {
        if (!line || line.startsWith("#")) continue
        line = line.replace(/(?<!\\)\s+$/, "")
        if (!line) continue

        let negate = false
        if (line.startsWith("!")) {
            negate = true
            line = line.slice(1)
        }

        const dirOnly = line.endsWith("/")
        line = line.replace(/\/+$/, "")
        if (!line) continue

        const anchored = line.includes("/")
        line = line.replace(/^\//, "")

        rules.push({
            baseDir,
            negate,
            dirOnly,
            anchored,
            regex: new RegExp("^" + globToRegexSource(line) + "$"),
        })
    }
    return rules
}

function readGitignore(dir) {
    try {
        return parseGitignore(fs.readFileSync(path.join(dir, ".gitignore"), "utf8"), dir)
    } catch {
        return []
    }
}

function findGitRoot(start) {
    let dir = start
    while (true) {
        if (fs.existsSync(path.join(dir, ".git"))) return dir
        const parent = path.dirname(dir)
        if (parent === dir) return null
        dir = parent
    }
}

/**
 * The folder that displayed paths are relative to:
 * the git root if there is one, else the current directory (when the scanned
 * folder is inside it), else the scanned folder itself.
 */
function findProjectBase(root) {
    const gitRoot = findGitRoot(root)
    if (gitRoot) return gitRoot

    const cwd = process.cwd()
    const rel = path.relative(cwd, root)
    if (!rel.startsWith("..") && !path.isAbsolute(rel)) return cwd

    return root
}

/** Rules from .gitignore files in folders above the scanned root, up to the git root. */
function loadAncestorRules(root) {
    const gitRoot = findGitRoot(root)
    if (!gitRoot || gitRoot === root) return []
    const chain = []
    for (let dir = path.dirname(root); ; dir = path.dirname(dir)) {
        chain.unshift(dir)
        if (dir === gitRoot) break
    }
    return chain.flatMap((dir) => readGitignore(dir))
}

/** Last matching rule wins, like git. Deeper .gitignore files come later in the list. */
function isGitIgnored(absPath, isDir, rules) {
    let ignored = false
    for (const rule of rules) {
        if (rule.dirOnly && !isDir) continue
        const rel = toPosix(path.relative(rule.baseDir, absPath))
        const subject = rule.anchored ? rel : path.posix.basename(rel)
        if (rule.regex.test(subject)) ignored = !rule.negate
    }
    return ignored
}

// ---------------------------------------------------------------------------
// File classification
// ---------------------------------------------------------------------------

function isEnvFile(name) {
    if (name !== ".env" && !name.startsWith(".env.")) return false
    return !/\.(example|sample|template|dist)$/i.test(name)
}

function isGeneratedFile(name) {
    return LOCKFILES.has(name) || GENERATED_SUFFIXES.some((suffix) => name.endsWith(suffix))
}

const estimateTokens = (text) => Math.ceil(text.length / 4)
const fmtNum = (n) => n.toLocaleString("en-US")

function formatBytes(n) {
    if (n < 1024) return `${n} B`
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / 1024 ** 2).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// Directory scan
// ---------------------------------------------------------------------------

/**
 * Walks the directory tree and returns the files to print plus everything skipped.
 *
 * Each file has two paths:
 *   rel     - relative to the scanned folder (used for include/exclude matching)
 *   display - relative to the project base (shown in headers and the tree)
 */
function collectFiles(root, opts, outputAbs, base) {
    const includeMatchers = opts.include.map(compileCliPattern)
    const excludeMatchers = opts.exclude.map(compileCliPattern)
    const files = []
    const skipped = []

    const skip = (rel, reason, detail) => skipped.push({ rel, reason, detail })
    const matchesAny = (matchers, target) => matchers.some((m) => m(target))

    function considerFile(abs, rel, name, rules) {
        if (outputAbs && abs === outputAbs) return skip(rel, "output file")

        const target = { rel, name, isDir: false }
        if (includeMatchers.length && !matchesAny(includeMatchers, target)) return
        if (matchesAny(excludeMatchers, target)) return skip(rel, "excluded")
        if (opts.gitignore && isGitIgnored(abs, false, rules)) return skip(rel, "gitignored")

        if (BINARY_EXTENSIONS.has(path.extname(name).toLowerCase())) return skip(rel, "binary")
        if (!opts.includeEnv && isEnvFile(name)) return skip(rel, "env file")
        if (!opts.keepGenerated && isGeneratedFile(name)) return skip(rel, "generated/lockfile")

        let size
        let buffer
        try {
            size = fs.statSync(abs).size
            if (size > opts.maxSize) return skip(rel, "too large", formatBytes(size))
            buffer = fs.readFileSync(abs)
        } catch (err) {
            return skip(rel, "unreadable", err.code || err.message)
        }

        if (buffer.subarray(0, SNIFF_BYTES).includes(0)) return skip(rel, "binary")

        const content = buffer.toString("utf8")
        const lines = content === "" ? 0 : content.replace(/\r?\n$/, "").split(/\r?\n/).length
        files.push({
            rel,
            display: toPosix(path.relative(base, abs)),
            size,
            content,
            lines,
            tokens: estimateTokens(content),
        })
    }

    function walk(dir, depth, inheritedRules) {
        let entries
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true })
        } catch (err) {
            skip(toPosix(path.relative(root, dir)) || ".", "unreadable folder", err.code || err.message)
            return
        }

        const rules = opts.gitignore ? inheritedRules.concat(readGitignore(dir)) : inheritedRules

        // Folders first, then files, alphabetical: keeps output order identical to the tree.
        entries.sort((a, b) => {
            if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
        })

        for (const entry of entries) {
            if (ALWAYS_SKIP.has(entry.name)) continue

            const abs = path.join(dir, entry.name)
            const rel = toPosix(path.relative(root, abs))

            if (entry.isSymbolicLink()) {
                skip(rel, "symlink")
            } else if (entry.isDirectory()) {
                const target = { rel, name: entry.name, isDir: true }
                if (matchesAny(excludeMatchers, target)) skip(rel + "/", "excluded")
                else if (opts.gitignore && isGitIgnored(abs, true, rules)) skip(rel + "/", "gitignored")
                else if (depth >= opts.depth) skip(rel + "/", "beyond depth limit")
                else walk(abs, depth + 1, rules)
            } else if (entry.isFile()) {
                considerFile(abs, rel, entry.name, rules)
            }
        }
    }

    walk(root, 0, opts.gitignore ? loadAncestorRules(root) : [])
    return { files, skipped }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderTree(rootName, files) {
    const root = { children: new Map(), isFile: false }
    for (const file of files) {
        let node = root
        const parts = file.display.split("/")
        parts.forEach((part, i) => {
            if (!node.children.has(part)) {
                node.children.set(part, { children: new Map(), isFile: i === parts.length - 1 })
            }
            node = node.children.get(part)
        })
    }

    const lines = [`${rootName}/`]
    const draw = (node, prefix) => {
        const items = [...node.children.entries()].sort(([an, a], [bn, b]) => {
            if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
            return an < bn ? -1 : an > bn ? 1 : 0
        })
        items.forEach(([name, child], idx) => {
            const isLast = idx === items.length - 1
            lines.push(`${prefix}${isLast ? "└── " : "├── "}${name}${child.isFile ? "" : "/"}`)
            if (!child.isFile) draw(child, prefix + (isLast ? "    " : "│   "))
        })
    }
    draw(root, "")
    return lines.join("\n")
}

function renderFile(file, opts) {
    let body = file.content.replace(/\r?\n$/, "")
    if (opts.lineNumbers && file.lines > 0) {
        const width = String(file.lines).length
        body = body
            .split(/\r?\n/)
            .map((line, i) => `${String(i + 1).padStart(width)} | ${line}`)
            .join("\n")
    }
    const meta = opts.tokens ? `  [${fmtNum(file.lines)} lines, ~${fmtNum(file.tokens)} tokens]` : ""
    return `${SEPARATOR}\nFile: ${file.display}${meta}\n${SEPARATOR}\n\n${body}\n`
}

function buildOutput(base, files, opts) {
    const parts = []
    if (opts.tree) {
        const label = `file${files.length === 1 ? "" : "s"}`
        const rootName = path.basename(base) || base
        parts.push(`Directory tree (${files.length} ${label}):\n${renderTree(rootName, files)}\n`)
    }
    for (const file of files) parts.push(renderFile(file, opts))
    return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Output destinations
// ---------------------------------------------------------------------------

function copyToClipboard(text) {
    const win = process.platform === "win32"
    const candidates =
        process.platform === "darwin"
            ? [["pbcopy", []]]
            : win
                ? [["clip", []]]
                : [
                    ["wl-copy", []],
                    ["xclip", ["-selection", "clipboard"]],
                    ["xsel", ["--clipboard", "--input"]],
                ]

    // Windows `clip` expects UTF-16LE with a BOM to keep non-ASCII characters intact.
    const input = win ? Buffer.from("\ufeff" + text, "utf16le") : text

    for (const [cmd, args] of candidates) {
        // Ignore stdout/stderr so tools that fork into the background don't hang us.
        const result = spawnSync(cmd, args, { input, stdio: ["pipe", "ignore", "ignore"] })
        if (!result.error && result.status === 0) return true
    }
    return false
}

function printSummary({ files, skipped, output, destinations, opts }) {
    const byReason = new Map()
    for (const s of skipped) byReason.set(s.reason, (byReason.get(s.reason) || 0) + 1)

    const reasons = [...byReason].map(([reason, n]) => `${reason}: ${n}`).join(", ")
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    const totalLines = files.reduce((sum, f) => sum + f.lines, 0)

    console.error("\n--- Summary ---")
    console.error(`Files printed : ${fmtNum(files.length)}`)
    console.error(`Skipped       : ${fmtNum(skipped.length)}${reasons ? ` (${reasons})` : ""}`)
    console.error(`Total size    : ${formatBytes(totalBytes)}, ${fmtNum(totalLines)} lines`)
    console.error(`Output        : ~${fmtNum(estimateTokens(output))} tokens`)
    console.error(`Sent to       : ${destinations.length ? destinations.join(", ") : "nowhere (see error above)"}`)

    if (opts.verbose && skipped.length) {
        console.error("\nSkipped paths:")
        for (const s of skipped) {
            console.error(`  ${s.rel}  -  ${s.reason}${s.detail ? ` (${s.detail})` : ""}`)
        }
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function fail(message) {
    console.error(`Error: ${message}`)
    process.exitCode = 1
}

function main() {
    let opts
    try {
        opts = parseArgs(process.argv.slice(2))
    } catch (err) {
        fail(`${err.message}\nRun with --help for usage.`)
        return
    }

    if (opts.help) {
        process.stdout.write(HELP)
        return
    }

    const root = path.resolve(opts.dir)
    let stat
    try {
        stat = fs.statSync(root)
    } catch {
        fail(`Directory not found: ${opts.dir}`)
        return
    }
    if (!stat.isDirectory()) {
        fail(`Not a directory: ${opts.dir}`)
        return
    }

    const outputAbs = opts.out ? path.resolve(opts.out) : null
    const base = findProjectBase(root)

    console.error(`Scanning: ${root}`)
    if (base !== root) console.error(`Paths relative to: ${base}`)
    if (opts.include.length) console.error(`Including: ${opts.include.join(", ")}`)
    if (opts.exclude.length) console.error(`Excluding: ${opts.exclude.join(", ")}`)

    const { files, skipped } = collectFiles(root, opts, outputAbs, base)

    if (files.length === 0) {
        console.error("\nNo files matched.")
        return
    }

    const output = buildOutput(base, files, opts)
    const destinations = []

    if (opts.out) {
        try {
            fs.mkdirSync(path.dirname(outputAbs), { recursive: true })
            fs.writeFileSync(outputAbs, output, "utf8")
            destinations.push(`file ${opts.out}`)
        } catch (err) {
            fail(`Could not write ${opts.out}: ${err.message}`)
        }
    }

    if (opts.copy) {
        if (copyToClipboard(output)) destinations.push("clipboard")
        else fail("Could not copy to clipboard (no pbcopy / clip / wl-copy / xclip / xsel found)")
    }

    if (!opts.out && !opts.copy) {
        process.stdout.write(output)
        destinations.push("stdout")
    }

    printSummary({ files, skipped, output, destinations, opts })
}

main()