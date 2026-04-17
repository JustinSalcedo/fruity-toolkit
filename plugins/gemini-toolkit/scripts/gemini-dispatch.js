import { spawn as realSpawn } from "node:child_process";
import { parseCliArgs, formatError } from "./utils.js";

const DEFAULT_TIMEOUT_MS = 120_000;
const ENOENT_HINT =
    "Gemini CLI not on PATH. Install with: npm i -g @google/gemini-cli";

export async function dispatch(
    {
        task,
        model = "auto",
        dirs = [],
        format = "json",
        yolo = true,
        timeout = DEFAULT_TIMEOUT_MS,
    } = {},
    { spawn = realSpawn } = {},
) {
    if (!task || typeof task !== "string") {
        return formatError(new Error("task is required and must be a string"));
    }
    if (format !== "json" && format !== "text") {
        return formatError(new Error(`format must be 'json' or 'text', got '${format}'`));
    }

    const args = ["-p", task, "--output-format", format];
    if (model && model !== "auto") {
        args.push("-m", model);
    }
    if (yolo) {
        args.push("-y");
    }
    if (Array.isArray(dirs) && dirs.length > 0) {
        args.push("--include-directories", dirs.join(","));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let child;
    try {
        child = spawn("gemini", args, { signal: controller.signal });
    } catch (err) {
        clearTimeout(timer);
        if (err?.code === "ENOENT") {
            return formatError(new Error(ENOENT_HINT));
        }
        return formatError(err);
    }

    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout?.on("data", (c) => stdoutChunks.push(c));
    child.stderr?.on("data", (c) => stderrChunks.push(c));

    const exit = await new Promise((resolve) => {
        child.on("error", (err) => resolve({ err }));
        child.on("close", (code, signal) => resolve({ code, signal }));
    });
    clearTimeout(timer);

    const stdout = Buffer.concat(stdoutChunks).toString("utf8");
    const stderr = Buffer.concat(stderrChunks).toString("utf8");

    if (exit.err) {
        if (exit.err.code === "ENOENT") return formatError(new Error(ENOENT_HINT));
        if (exit.err.name === "AbortError") {
            return formatError(new Error(`gemini timed out after ${timeout}ms`));
        }
        return formatError(exit.err);
    }
    if (controller.signal.aborted) {
        return formatError(new Error(`gemini timed out after ${timeout}ms`));
    }
    if (exit.code !== 0) {
        return formatError(
            new Error(`gemini exited with code ${exit.code}: ${stderr.trim() || stdout.trim()}`),
        );
    }

    return buildEnvelope(stdout, format);
}

function buildEnvelope(stdout, format) {
    if (format === "text") {
        return {
            ok: true,
            response: stdout.trim(),
            model: null,
            stats: { input: 0, output: 0, cached: 0, tool_calls: 0 },
            error: null,
        };
    }

    let parsed;
    try {
        parsed = JSON.parse(stdout);
    } catch {
        return {
            ok: true,
            response: stdout.trim(),
            model: null,
            stats: { input: 0, output: 0, cached: 0, tool_calls: 0 },
            error: null,
        };
    }

    const { model, tokens } = extractMainModel(parsed);
    const toolCalls = parsed?.stats?.tools?.totalCalls ?? 0;

    return {
        ok: true,
        response: parsed?.response ?? "",
        model,
        stats: {
            input: tokens?.input ?? 0,
            output: tokens?.candidates ?? 0,
            cached: tokens?.cached ?? 0,
            tool_calls: toolCalls,
        },
        error: null,
    };
}

function extractMainModel(parsed) {
    const models = parsed?.stats?.models;
    if (!models || typeof models !== "object") {
        return { model: null, tokens: null };
    }
    for (const [name, data] of Object.entries(models)) {
        if (data?.roles?.main) {
            return { model: name, tokens: data.tokens };
        }
    }
    const [[name, data] = []] = Object.entries(models);
    return { model: name ?? null, tokens: data?.tokens ?? null };
}

async function main() {
    const { values } = parseCliArgs(process.argv.slice(2), {
        options: {
            task: { type: "string" },
            model: { type: "string" },
            dirs: { type: "string" },
            format: { type: "string" },
            yolo: { type: "string" },
            timeout: { type: "string" },
        },
    });

    const result = await dispatch({
        task: values.task,
        model: values.model,
        dirs: values.dirs ? values.dirs.split(",").map((s) => s.trim()).filter(Boolean) : [],
        format: values.format ?? "json",
        yolo: values.yolo !== "false",
        timeout: values.timeout ? Number(values.timeout) : undefined,
    });
    process.stdout.write(JSON.stringify(result) + "\n");
    if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
