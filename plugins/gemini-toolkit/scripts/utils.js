import { readFile, mkdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const MIME_BY_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
};

const EXT_BY_MIME = Object.fromEntries(
    Object.entries(MIME_BY_EXT).map(([ext, mime]) => [mime, ext]),
);

export function parseCliArgs(argv, options = {}) {
    return parseArgs({
        args: argv,
        options: options.options ?? {},
        allowPositionals: true,
        strict: false,
        ...options,
    });
}

export function detectMimeType(filePath) {
    return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? null;
}

export async function readFileAsBase64(filePath) {
    const info = await stat(filePath);
    if (info.size > MAX_FILE_BYTES) {
        throw new Error(
            `File ${filePath} is ${info.size} bytes; max is ${MAX_FILE_BYTES} (20MB)`,
        );
    }
    const buf = await readFile(filePath);
    return buf.toString("base64");
}

export function formatError(error) {
    const message = error?.message ?? String(error);
    return { ok: false, error: message };
}

async function dirExists(path) {
    try {
        const info = await stat(path);
        return info.isDirectory();
    } catch {
        return false;
    }
}

export async function resolveOutputPath(cwd, mimeType) {
    const ext = EXT_BY_MIME[mimeType] ?? ".bin";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const hash = randomBytes(4).toString("hex");
    const filename = `${stamp}-${hash}${ext}`;

    for (const candidate of ["assets", "images"]) {
        const dir = join(cwd, candidate);
        if (await dirExists(dir)) {
            return join(dir, filename);
        }
    }

    const fallback = "/tmp/gemini-toolkit";
    await mkdir(fallback, { recursive: true });
    return join(fallback, filename);
}

export const constants = { MAX_FILE_BYTES, MIME_BY_EXT, EXT_BY_MIME };
