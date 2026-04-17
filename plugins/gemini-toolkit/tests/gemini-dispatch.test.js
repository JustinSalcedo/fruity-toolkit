import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { dispatch } from "../scripts/gemini-dispatch.js";

const here = dirname(fileURLToPath(import.meta.url));

function fakeChild({ stdout = "", stderr = "", code = 0, error } = {}) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
        if (error) {
            child.emit("error", error);
            return;
        }
        if (stdout) child.stdout.emit("data", Buffer.from(stdout));
        if (stderr) child.stderr.emit("data", Buffer.from(stderr));
        child.emit("close", code, null);
    });
    return child;
}

function fakeSpawn(outcome) {
    const calls = [];
    const spawn = (cmd, args) => {
        calls.push({ cmd, args });
        return fakeChild(outcome);
    };
    return { spawn, calls };
}

test("dispatch: happy path parses JSON and flattens stats", async () => {
    const fixture = await readFile(resolve(here, "fixtures/cli-json-response.json"), "utf8");
    const { spawn, calls } = fakeSpawn({ stdout: fixture, code: 0 });

    const result = await dispatch(
        { task: "Map the auth flow", dirs: ["apps/api", "packages/auth"] },
        { spawn },
    );

    assert.equal(result.ok, true);
    assert.match(result.response, /authentication flow/);
    assert.equal(result.model, "gemini-3-flash-preview");
    assert.equal(result.stats.input, 8500);
    assert.equal(result.stats.output, 30);
    assert.equal(result.stats.cached, 8133);
    assert.equal(result.stats.tool_calls, 0);
    assert.deepEqual(calls[0].args, [
        "-p",
        "Map the auth flow",
        "--output-format",
        "json",
        "-y",
        "--include-directories",
        "apps/api,packages/auth",
    ]);
});

test("dispatch: text format bypasses JSON parsing", async () => {
    const { spawn } = fakeSpawn({ stdout: "raw text from gemini\n", code: 0 });
    const result = await dispatch({ task: "hi", format: "text" }, { spawn });
    assert.equal(result.ok, true);
    assert.equal(result.response, "raw text from gemini");
});

test("dispatch: falls back when JSON is malformed", async () => {
    const { spawn } = fakeSpawn({ stdout: "not json at all", code: 0 });
    const result = await dispatch({ task: "hi" }, { spawn });
    assert.equal(result.ok, true);
    assert.equal(result.response, "not json at all");
});

test("dispatch: ENOENT surfaces install hint", async () => {
    const err = Object.assign(new Error("spawn gemini ENOENT"), { code: "ENOENT" });
    const spawn = () => {
        throw err;
    };
    const result = await dispatch({ task: "hi" }, { spawn });
    assert.equal(result.ok, false);
    assert.match(result.error, /Gemini CLI not on PATH/);
});

test("dispatch: non-zero exit surfaces stderr", async () => {
    const { spawn } = fakeSpawn({ stdout: "", stderr: "quota exceeded", code: 2 });
    const result = await dispatch({ task: "hi" }, { spawn });
    assert.equal(result.ok, false);
    assert.match(result.error, /exited with code 2/);
    assert.match(result.error, /quota exceeded/);
});

test("dispatch: rejects missing task", async () => {
    const result = await dispatch({}, { spawn: () => fakeChild() });
    assert.equal(result.ok, false);
    assert.match(result.error, /task is required/);
});

test("dispatch: model 'auto' omits -m", async () => {
    const { spawn, calls } = fakeSpawn({ stdout: "{}", code: 0 });
    await dispatch({ task: "hi", model: "auto" }, { spawn });
    assert.ok(!calls[0].args.includes("-m"));
});

test("dispatch: explicit model adds -m", async () => {
    const { spawn, calls } = fakeSpawn({ stdout: "{}", code: 0 });
    await dispatch({ task: "hi", model: "gemini-3-pro" }, { spawn });
    const idx = calls[0].args.indexOf("-m");
    assert.notEqual(idx, -1);
    assert.equal(calls[0].args[idx + 1], "gemini-3-pro");
});
