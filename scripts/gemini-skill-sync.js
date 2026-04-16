import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn as realSpawn } from "node:child_process";
import { parseCliArgs, formatError } from "./utils.js";

const TOOL_MAP = {
    Read: "read_file",
    Grep: "grep_search",
    Glob: "glob",
    Bash: "run_shell_command",
    Edit: "replace",
    Write: "write_file",
    WebSearch: "google_web_search",
    WebFetch: "web_fetch",
};

const here = dirname(fileURLToPath(import.meta.url));
const SCAFFOLD_PATH = resolve(here, "..", "templates", "gemini-skill-scaffold.md");

export async function syncSkill(
    { skillPath, install = false, skillsRoot = defaultSkillsRoot() } = {},
    { spawn = realSpawn, scaffoldPath = SCAFFOLD_PATH } = {},
) {
    try {
        if (!skillPath) throw new Error("skillPath is required");

        const resolved = await resolveSkillFile(skillPath);
        const raw = await readFile(resolved, "utf8");
        const { frontmatter, body } = parseSkillMarkdown(raw);

        if (!frontmatter.name) {
            throw new Error("skill is missing required frontmatter field 'name'");
        }

        const claudeTools = normalizeTools(frontmatter["allowed-tools"] ?? frontmatter.tools);
        const { mapped, warnings } = mapTools(claudeTools);

        const rewrittenBody = rewriteBodyTools(body);
        const toolsSection = renderToolsSection(mapped);
        const mappingSummary = mapped.length
            ? mapped.map(([claude, gemini]) => `${claude}->${gemini}`).join(", ")
            : "none";

        const scaffold = await readFile(scaffoldPath, "utf8");
        const filled = fillTemplate(scaffold, {
            name: frontmatter.name,
            description: frontmatter.description ?? "",
            title: toTitle(frontmatter.name),
            body: rewrittenBody.trim(),
            tools_section: toolsSection,
            source_path: resolved,
            date: new Date().toISOString().slice(0, 10),
            mapping_summary: mappingSummary,
        });

        const targetDir = join(skillsRoot, frontmatter.name);
        const targetFile = join(targetDir, "SKILL.md");
        await mkdir(targetDir, { recursive: true });
        await writeFile(targetFile, filled);

        let installed = false;
        if (install) {
            const res = await runGeminiLink(targetDir, spawn);
            if (!res.ok) throw new Error(`gemini skills link failed: ${res.error}`);
            installed = true;
        }

        return {
            ok: true,
            geminiSkillPath: targetFile,
            installed,
            warnings,
        };
    } catch (err) {
        return formatError(err);
    }
}

function defaultSkillsRoot() {
    return join(homedir(), ".gemini", "skills", "synced");
}

async function resolveSkillFile(skillPath) {
    const info = await stat(skillPath).catch(() => null);
    if (!info) throw new Error(`skill path not found: ${skillPath}`);
    if (info.isDirectory()) {
        const candidate = join(skillPath, "SKILL.md");
        const c = await stat(candidate).catch(() => null);
        if (!c) throw new Error(`no SKILL.md inside ${skillPath}`);
        return candidate;
    }
    if (extname(skillPath) !== ".md") {
        throw new Error(`skill path must be a .md file or a directory containing SKILL.md`);
    }
    return skillPath;
}

export function parseSkillMarkdown(raw) {
    if (!raw.startsWith("---")) {
        throw new Error("skill is missing YAML frontmatter (file does not start with '---')");
    }
    const end = raw.indexOf("\n---", 3);
    if (end === -1) {
        throw new Error("skill frontmatter is not terminated with a closing '---'");
    }
    const fmText = raw.slice(3, end).trim();
    const body = raw.slice(end + 4).replace(/^\s*\n/, "");

    const frontmatter = {};
    for (const line of fmText.split("\n")) {
        if (!line.trim() || line.trim().startsWith("#")) continue;
        const m = line.match(/^([\w-]+):\s*(.*)$/);
        if (!m) continue;
        const [, key, rawValue] = m;
        frontmatter[key] = parseYamlScalar(rawValue);
    }
    return { frontmatter, body };
}

function parseYamlScalar(raw) {
    const v = raw.trim();
    if (v === "") return "";
    if (v.startsWith("[") && v.endsWith("]")) {
        return v
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
            .filter(Boolean);
    }
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1);
    }
    return v;
}

function normalizeTools(tools) {
    if (!tools) return [];
    if (Array.isArray(tools)) return tools.map(cleanToolName).filter(Boolean);
    if (typeof tools === "string") {
        return tools
            .split(",")
            .map((s) => s.trim())
            .map(cleanToolName)
            .filter(Boolean);
    }
    return [];
}

function cleanToolName(name) {
    return String(name).replace(/\(.*\)$/, "").trim();
}

function mapTools(claudeTools) {
    const mapped = [];
    const warnings = [];
    const seen = new Set();
    for (const name of claudeTools) {
        if (seen.has(name)) continue;
        seen.add(name);
        const gemini = TOOL_MAP[name];
        if (gemini) {
            mapped.push([name, gemini]);
        } else {
            warnings.push(`Tool '${name}' has no Gemini equivalent — skipped`);
        }
    }
    return { mapped, warnings };
}

function rewriteBodyTools(body) {
    let out = body;
    for (const [claude, gemini] of Object.entries(TOOL_MAP)) {
        const pattern = new RegExp(`\\b${claude}\\b`, "g");
        out = out.replace(pattern, gemini);
    }
    return out;
}

function renderToolsSection(mapped) {
    if (mapped.length === 0) {
        return "_No tools from the Claude skill were mappable; the Gemini agent will use defaults._";
    }
    return mapped.map(([claude, gemini]) => `- \`${gemini}\` (translated from \`${claude}\`)`).join("\n");
}

function fillTemplate(template, values) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
        values[key] === undefined ? "" : String(values[key]),
    );
}

function toTitle(name) {
    return name
        .split(/[-_]/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
        .join(" ");
}

function runGeminiLink(dir, spawn) {
    return new Promise((resolvePromise) => {
        let child;
        try {
            child = spawn("gemini", ["skills", "link", dir, "--consent"]);
        } catch (err) {
            resolvePromise({ ok: false, error: err.message });
            return;
        }
        const stderr = [];
        child.stderr?.on("data", (c) => stderr.push(c));
        child.on("error", (err) => resolvePromise({ ok: false, error: err.message }));
        child.on("close", (code) => {
            if (code === 0) resolvePromise({ ok: true });
            else resolvePromise({ ok: false, error: Buffer.concat(stderr).toString("utf8") || `exit ${code}` });
        });
    });
}

function resolveByName(name) {
    const candidates = [
        join(homedir(), ".claude", "skills", name, "SKILL.md"),
        join(homedir(), ".claude", "skills", `${name}.md`),
    ];
    return candidates;
}

async function main() {
    const { values, positionals } = parseCliArgs(process.argv.slice(2), {
        options: {
            skillPath: { type: "string" },
            install: { type: "string" },
        },
    });

    let skillPath = values.skillPath ?? positionals[0];

    if (skillPath && !skillPath.includes("/") && !skillPath.endsWith(".md")) {
        const candidates = resolveByName(skillPath);
        for (const c of candidates) {
            const info = await stat(c).catch(() => null);
            if (info) {
                skillPath = c;
                break;
            }
        }
    }

    const install = values.install === "true";
    const result = await syncSkill({ skillPath, install });
    process.stdout.write(JSON.stringify(result) + "\n");
    if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
