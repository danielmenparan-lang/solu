import { readFileSync, writeFileSync } from "fs";

const envPath = ".env";
let env = readFileSync(envPath, "utf8");
const lines = env.split(/\r?\n/);
const idx = lines.findIndex((l) => l.startsWith("ANTHROPIC_API_KEY="));

if (idx < 0) {
  console.log("RESULT: NO_LINE");
  process.exit(0);
}

let value = lines[idx].slice("ANTHROPIC_API_KEY=".length).trim();
value = value.replace(/^["']|["']$/g, "");
lines[idx] = `ANTHROPIC_API_KEY=${value}`;
writeFileSync(envPath, `${lines.join("\n")}\n`, "utf8");

if (!value.startsWith("sk-ant-")) {
  console.log("RESULT: BAD_FORMAT");
  process.exit(0);
}

const models = ["claude-sonnet-4-6", "claude-haiku-4-5-20251001"];
for (const model of models) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": value,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8,
      messages: [{ role: "user", content: "OK" }],
    }),
  });

  if (res.status === 200) {
    console.log(`RESULT: OK model=${model}`);
    process.exit(0);
  }

  const body = await res.text();
  if (body.includes("credit balance")) {
    console.log("RESULT: NO_CREDITS");
    process.exit(0);
  }
  if (body.includes("authentication") || body.includes("x-api-key")) {
    console.log("RESULT: BAD_KEY");
    process.exit(0);
  }
}

console.log("RESULT: ERROR");
