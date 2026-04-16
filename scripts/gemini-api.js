import { writeFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import {
    parseCliArgs,
    detectMimeType,
    readFileAsBase64,
    resolveOutputPath,
    formatError,
    constants,
} from "./utils.js";

function alignExtensionToMime(path, mimeType) {
    const wanted = constants.EXT_BY_MIME[mimeType];
    if (!wanted) return path;
    const current = extname(path).toLowerCase();
    if (current === wanted) return path;
    return path.slice(0, path.length - current.length) + wanted;
}

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const DEFAULT_VISION_MODEL = "gemini-2.5-flash";

function apiKey() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set in the environment");
    return key;
}

async function postGenerateContent(model, body, { fetchImpl = globalThis.fetch } = {}) {
    const url = `${API_BASE}/${model}:generateContent`;
    const res = await fetchImpl(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey(),
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        const snippet = text.slice(0, 500);
        if (res.status === 429) {
            throw new Error(`Gemini API rate limited (429): ${snippet}`);
        }
        if (res.status === 400) {
            throw new Error(`Gemini API bad request (400): ${snippet}`);
        }
        throw new Error(`Gemini API error (${res.status}): ${snippet}`);
    }
    return res.json();
}

export async function generateImage(
    { prompt, model = DEFAULT_IMAGE_MODEL, outputPath = null } = {},
    deps = {},
) {
    try {
        if (!prompt || typeof prompt !== "string") {
            throw new Error("prompt is required and must be a string");
        }

        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        };
        const json = await postGenerateContent(model, body, deps);

        const parts = json?.candidates?.[0]?.content?.parts ?? [];
        const textParts = parts.filter((p) => typeof p?.text === "string").map((p) => p.text);
        const imagePart = parts.find((p) => p?.inlineData?.data);

        if (!imagePart) {
            throw new Error(
                "Gemini response did not include inlineData (no image part returned)",
            );
        }

        const mimeType = imagePart.inlineData.mimeType ?? "image/png";
        const buffer = Buffer.from(imagePart.inlineData.data, "base64");
        const basePath = outputPath ?? (await resolveOutputPath(process.cwd(), mimeType));
        const finalPath = outputPath ? alignExtensionToMime(basePath, mimeType) : basePath;
        await writeFile(finalPath, buffer);

        return {
            ok: true,
            text: textParts.join("\n").trim() || null,
            image: { mimeType, filePath: finalPath },
        };
    } catch (err) {
        return formatError(err);
    }
}

export async function analyzeVision(
    {
        task,
        files = [],
        model = DEFAULT_VISION_MODEL,
        format = "text",
    } = {},
    deps = {},
) {
    try {
        if (!task || typeof task !== "string") {
            throw new Error("task is required and must be a string");
        }
        if (!Array.isArray(files) || files.length === 0) {
            throw new Error("files must be a non-empty array of paths");
        }
        if (format !== "text" && format !== "json") {
            throw new Error(`format must be 'text' or 'json', got '${format}'`);
        }

        const fileParts = [];
        for (const filePath of files) {
            const mime = detectMimeType(filePath);
            if (!mime) {
                throw new Error(
                    `Unsupported file type for ${filePath}. Supported: ${Object.values(constants.MIME_BY_EXT).join(", ")}`,
                );
            }
            const info = await stat(filePath).catch(() => null);
            if (!info) throw new Error(`File not found: ${filePath}`);
            const data = await readFileAsBase64(filePath);
            fileParts.push({ inlineData: { mimeType: mime, data } });
        }

        const body = {
            contents: [{ parts: [...fileParts, { text: task }] }],
        };
        const json = await postGenerateContent(model, body, deps);

        const parts = json?.candidates?.[0]?.content?.parts ?? [];
        const text = parts
            .filter((p) => typeof p?.text === "string")
            .map((p) => p.text)
            .join("\n")
            .trim();

        let response = text;
        if (format === "json") {
            try {
                response = JSON.parse(text);
            } catch {
                /* fall back to raw text */
            }
        }

        return {
            ok: true,
            response,
            filesProcessed: [...files],
        };
    } catch (err) {
        return formatError(err);
    }
}

async function main() {
    const { values } = parseCliArgs(process.argv.slice(2), {
        options: {
            mode: { type: "string" },
            prompt: { type: "string" },
            task: { type: "string" },
            files: { type: "string" },
            model: { type: "string" },
            output: { type: "string" },
            format: { type: "string" },
        },
    });

    const mode = values.mode ?? "vision";
    let result;
    if (mode === "image") {
        result = await generateImage({
            prompt: values.prompt,
            model: values.model,
            outputPath: values.output ?? null,
        });
    } else if (mode === "vision") {
        const files = values.files ? values.files.split(",").map((s) => s.trim()).filter(Boolean) : [];
        result = await analyzeVision({
            task: values.task,
            files,
            model: values.model,
            format: values.format ?? "text",
        });
    } else {
        result = formatError(new Error(`Unknown mode '${mode}'. Use 'image' or 'vision'.`));
    }

    process.stdout.write(JSON.stringify(result) + "\n");
    if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
