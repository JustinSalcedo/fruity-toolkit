import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { syncSkill, parseSkillMarkdown } from "../scripts/gemini-skill-sync.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "fixtures/sample-skill.md");

async function freshTmpRoot() {
    const root = join(tmpdir(), `gt-skill-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(root, { recursive: true });
    return root;
}

test("parseSkillMarkdown: extracts frontmatter and body", async () => {
    const raw = await readFile(fixturePath, "utf8");
    const { frontmatter, body } = parseSkillMarkdown(raw);
    assert.equal(frontmatter.name, "spec-check");
    assert.match(frontmatter.description, /design spec/);
    assert.deepEqual(frontmatter["allowed-tools"], ["Read", "Grep", "Bash", "WebFetch", "LSP"]);
    assert.match(body, /# spec-check/);
});

test("parseSkillMarkdown: rejects missing frontmatter", () => {
    assert.throws(() => parseSkillMarkdown("# no frontmatter here"), /missing YAML frontmatter/);
});

test("parseSkillMarkdown: rejects unterminated frontmatter", () => {
    assert.throws(
        () => parseSkillMarkdown("---\nname: x\ndescription: y\n"),
        /not terminated with a closing/,
    );
});

test("syncSkill: happy path writes directory-form skill with tool warnings", async () => {
    const root = await freshTmpRoot();
    const result = await syncSkill({ skillPath: fixturePath, skillsRoot: root });

    assert.equal(result.ok, true);
    assert.equal(result.geminiSkillPath, join(root, "spec-check", "SKILL.md"));
    assert.equal(result.installed, false);
    assert.deepEqual(result.warnings, ["Tool 'LSP' has no Gemini equivalent — skipped"]);

    const written = await readFile(result.geminiSkillPath, "utf8");
    assert.match(written, /^---\nname: spec-check\n/);
    assert.match(written, /description: .*design spec/);
    assert.match(written, /read_file/);
    assert.match(written, /grep_search/);
    assert.match(written, /run_shell_command/);
    assert.match(written, /web_fetch/);
    const bodyBeforeAllowed = written.split("## Allowed tools")[0];
    assert.doesNotMatch(bodyBeforeAllowed, /Use `Read`/);
    assert.doesNotMatch(bodyBeforeAllowed, /Use `Grep`/);
    assert.match(written, /Synced from Claude skill:/);

    await rm(root, { recursive: true, force: true });
});

test("syncSkill: rejects missing skillPath", async () => {
    const result = await syncSkill({});
    assert.equal(result.ok, false);
    assert.match(result.error, /skillPath is required/);
});

test("syncSkill: rejects nonexistent path", async () => {
    const result = await syncSkill({ skillPath: "/tmp/does-not-exist-gt.md" });
    assert.equal(result.ok, false);
    assert.match(result.error, /skill path not found/);
});

test("syncSkill: rejects skill missing 'name' field", async () => {
    const root = await freshTmpRoot();
    const bad = join(root, "bad.md");
    await writeFile(bad, "---\ndescription: no name here\n---\nbody");
    const result = await syncSkill({ skillPath: bad, skillsRoot: root });
    assert.equal(result.ok, false);
    assert.match(result.error, /missing required frontmatter field 'name'/);
    await rm(root, { recursive: true, force: true });
});

test("syncSkill: accepts a skill directory containing SKILL.md", async () => {
    const root = await freshTmpRoot();
    const srcDir = join(root, "src-skill");
    await mkdir(srcDir, { recursive: true });
    await writeFile(
        join(srcDir, "SKILL.md"),
        "---\nname: dir-skill\ndescription: a skill provided as a directory\nallowed-tools: [Read]\n---\nUse Read to load files.",
    );
    const outRoot = join(root, "out");
    const result = await syncSkill({ skillPath: srcDir, skillsRoot: outRoot });
    assert.equal(result.ok, true);
    assert.equal(result.geminiSkillPath, join(outRoot, "dir-skill", "SKILL.md"));
    const written = await readFile(result.geminiSkillPath, "utf8");
    assert.match(written, /read_file/);
    await rm(root, { recursive: true, force: true });
});

test("syncSkill: install=true calls spawn with gemini skills link", async () => {
    const root = await freshTmpRoot();
    const { EventEmitter } = await import("node:events");
    const calls = [];
    const spawn = (cmd, args) => {
        calls.push({ cmd, args });
        const c = new EventEmitter();
        c.stderr = new EventEmitter();
        queueMicrotask(() => c.emit("close", 0));
        return c;
    };

    const result = await syncSkill(
        { skillPath: fixturePath, install: true, skillsRoot: root },
        { spawn },
    );
    assert.equal(result.ok, true);
    assert.equal(result.installed, true);
    assert.equal(calls[0].cmd, "gemini");
    assert.deepEqual(calls[0].args.slice(0, 2), ["skills", "link"]);
    assert.equal(calls[0].args[2], join(root, "spec-check"));
    assert.ok(calls[0].args.includes("--consent"));
    await rm(root, { recursive: true, force: true });
});
