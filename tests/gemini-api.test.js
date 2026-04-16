import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { generateImage, analyzeVision } from "../scripts/gemini-api.js";

const here = dirname(fileURLToPath(import.meta.url));

function makeFetchFrom(responseOrFn) {
    const calls = [];
    const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        const r = typeof responseOrFn === "function" ? await responseOrFn({ url, init }) : responseOrFn;
        return {
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            async json() { return r.body; },
            async text() { return typeof r.body === "string" ? r.body : JSON.stringify(r.body); },
        };
    };
    return { fetchImpl, calls };
}

const origKey = process.env.GEMINI_API_KEY;
beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
});
afterEach(() => {
    if (origKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = origKey;
});

test("generateImage: happy path writes PNG to explicit output path", async () => {
    const body = JSON.parse(await readFile(resolve(here, "fixtures/api-image-response.json"), "utf8"));
    const { fetchImpl, calls } = makeFetchFrom({ status: 200, body });

    const outDir = await mkdir(join(tmpdir(), `gt-img-${Date.now()}`), { recursive: true });
    const outPath = join(outDir, "out.png");

    const result = await generateImage(
        { prompt: "a red circle", outputPath: outPath },
        { fetchImpl },
    );

    assert.equal(result.ok, true);
    assert.equal(result.image.mimeType, "image/png");
    assert.equal(result.image.filePath, outPath);
    assert.match(result.text, /1x1 PNG/);
    const written = await stat(outPath);
    assert.ok(written.size > 0);
    assert.match(calls[0].url, /gemini-3\.1-flash-image-preview:generateContent/);
    assert.equal(calls[0].init.headers["x-goog-api-key"], "test-key");
    await rm(outDir, { recursive: true, force: true });
});

test("generateImage: falls back to /tmp when no outputPath given", async () => {
    const body = JSON.parse(await readFile(resolve(here, "fixtures/api-image-response.json"), "utf8"));
    const { fetchImpl } = makeFetchFrom({ status: 200, body });

    const result = await generateImage({ prompt: "a red circle" }, { fetchImpl });
    assert.equal(result.ok, true);
    const pathMatches =
        result.image.filePath.startsWith("/tmp/gemini-toolkit/") ||
        result.image.filePath.includes("/assets/") ||
        result.image.filePath.includes("/images/");
    assert.ok(pathMatches, `Unexpected output path: ${result.image.filePath}`);
    await rm(result.image.filePath, { force: true });
});

test("generateImage: 429 rate limit surfaces as error", async () => {
    const { fetchImpl } = makeFetchFrom({ status: 429, body: "Too Many Requests" });
    const result = await generateImage({ prompt: "x" }, { fetchImpl });
    assert.equal(result.ok, false);
    assert.match(result.error, /rate limited.*429/);
});

test("generateImage: 400 bad request surfaces as error", async () => {
    const { fetchImpl } = makeFetchFrom({ status: 400, body: { error: "invalid model" } });
    const result = await generateImage({ prompt: "x" }, { fetchImpl });
    assert.equal(result.ok, false);
    assert.match(result.error, /bad request.*400/);
});

test("generateImage: missing API key", async () => {
    delete process.env.GEMINI_API_KEY;
    const { fetchImpl } = makeFetchFrom({ status: 200, body: {} });
    const result = await generateImage({ prompt: "x" }, { fetchImpl });
    assert.equal(result.ok, false);
    assert.match(result.error, /GEMINI_API_KEY is not set/);
});

test("generateImage: rejects missing prompt", async () => {
    const { fetchImpl } = makeFetchFrom({ status: 200, body: {} });
    const result = await generateImage({}, { fetchImpl });
    assert.equal(result.ok, false);
    assert.match(result.error, /prompt is required/);
});

test("generateImage: rewrites extension when output path MIME mismatches response", async () => {
    const jpegBody = {
        candidates: [
            {
                content: {
                    parts: [
                        { inlineData: { mimeType: "image/jpeg", data: "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AH8H/9k=" } },
                    ],
                },
            },
        ],
    };
    const { fetchImpl } = makeFetchFrom({ status: 200, body: jpegBody });

    const outDir = await mkdir(join(tmpdir(), `gt-ext-${Date.now()}`), { recursive: true });
    const requestedPath = join(outDir, "out.png");

    const result = await generateImage(
        { prompt: "anything", outputPath: requestedPath },
        { fetchImpl },
    );

    assert.equal(result.ok, true);
    assert.equal(result.image.mimeType, "image/jpeg");
    assert.equal(result.image.filePath, join(outDir, "out.jpeg"));
    const written = await stat(result.image.filePath);
    assert.ok(written.size > 0);
    await rm(outDir, { recursive: true, force: true });
});

test("generateImage: keeps output path when extension already matches", async () => {
    const body = JSON.parse(await readFile(resolve(here, "fixtures/api-image-response.json"), "utf8"));
    const { fetchImpl } = makeFetchFrom({ status: 200, body });

    const outDir = await mkdir(join(tmpdir(), `gt-keep-${Date.now()}`), { recursive: true });
    const outPath = join(outDir, "out.png");

    const result = await generateImage(
        { prompt: "x", outputPath: outPath },
        { fetchImpl },
    );
    assert.equal(result.image.filePath, outPath);
    await rm(outDir, { recursive: true, force: true });
});

test("generateImage: response with no image part errors", async () => {
    const { fetchImpl } = makeFetchFrom({
        status: 200,
        body: { candidates: [{ content: { parts: [{ text: "sorry" }] } }] },
    });
    const result = await generateImage({ prompt: "x" }, { fetchImpl });
    assert.equal(result.ok, false);
    assert.match(result.error, /did not include inlineData/);
});

test("analyzeVision: happy path with a real PNG on disk", async () => {
    const body = JSON.parse(await readFile(resolve(here, "fixtures/api-vision-response.json"), "utf8"));
    const { fetchImpl, calls } = makeFetchFrom({ status: 200, body });

    const pngPath = join(tmpdir(), `gt-vision-${Date.now()}.png`);
    const tinyPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAADAAHO+aVfAAAAAElFTkSuQmCC",
        "base64",
    );
    await writeFile(pngPath, tinyPng);

    const result = await analyzeVision(
        { task: "Describe this", files: [pngPath] },
        { fetchImpl },
    );

    assert.equal(result.ok, true);
    assert.match(result.response, /single white pixel/);
    assert.deepEqual(result.filesProcessed, [pngPath]);

    const sentBody = JSON.parse(calls[0].init.body);
    assert.equal(sentBody.contents[0].parts[0].inlineData.mimeType, "image/png");
    assert.equal(sentBody.contents[0].parts[1].text, "Describe this");

    await rm(pngPath, { force: true });
});

test("analyzeVision: unsupported MIME type rejected", async () => {
    const { fetchImpl } = makeFetchFrom({ status: 200, body: {} });
    const txtPath = join(tmpdir(), `gt-vision-${Date.now()}.txt`);
    await writeFile(txtPath, "hi");
    const result = await analyzeVision(
        { task: "x", files: [txtPath] },
        { fetchImpl },
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /Unsupported file type/);
    await rm(txtPath, { force: true });
});

test("analyzeVision: missing file rejected", async () => {
    const { fetchImpl } = makeFetchFrom({ status: 200, body: {} });
    const result = await analyzeVision(
        { task: "x", files: ["/tmp/does-not-exist-gt.png"] },
        { fetchImpl },
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /File not found/);
});

test("analyzeVision: empty files list rejected", async () => {
    const { fetchImpl } = makeFetchFrom({ status: 200, body: {} });
    const result = await analyzeVision({ task: "x", files: [] }, { fetchImpl });
    assert.equal(result.ok, false);
    assert.match(result.error, /non-empty array/);
});

test("analyzeVision: format=json parses structured output", async () => {
    const body = {
        candidates: [{ content: { parts: [{ text: '{"verdict":"ok"}' }] } }],
    };
    const { fetchImpl } = makeFetchFrom({ status: 200, body });

    const pngPath = join(tmpdir(), `gt-json-${Date.now()}.png`);
    await writeFile(
        pngPath,
        Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAADAAHO+aVfAAAAAElFTkSuQmCC",
            "base64",
        ),
    );

    const result = await analyzeVision(
        { task: "judge", files: [pngPath], format: "json" },
        { fetchImpl },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.response, { verdict: "ok" });
    await rm(pngPath, { force: true });
});
