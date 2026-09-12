import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("js/next-onekan-v01.js", "utf8");
const supabase = fs.readFileSync("js/supabase.js", "utf8");
const dataCss = fs.readFileSync("css/next-onekan-data.css", "utf8");

// The repurposed app must boot the new shell only.
assert.match(html, /<title>다음 한칸<\/title>/);
assert.match(html, /id="authGate"/);
assert.match(html, /id="appShell"/);
assert.match(html, /type="module" src="\.\/js\/next-onekan-v01\.js\?v=\d+"/);
assert.doesNotMatch(html, /<script[^>]+src="\.\/js\/app\.js/);
assert.doesNotMatch(html, /<script[^>]+src="\.\/js\/unified-workspace\.js/);

// Structure navigation: filters, forward/reverse mode, and per-level expansion.
assert.match(html, /data-direction="forward"/);
assert.match(html, /data-direction="reverse"/);
assert.match(html, /id="toggleAllTree"/);
assert.match(app, /next-onekan:view-direction/);
assert.match(app, /next-onekan:expanded-items/);
assert.match(app, /function appendForward\(/);
assert.match(app, /function appendReverse\(/);
assert.match(app, /data-toggle-node/);

// Auth must use the browser Supabase client and current session.
assert.match(app, /supabase\.auth\.signInWithPassword/);
assert.match(app, /supabase\.auth\.signUp/);
assert.match(app, /supabase\.auth\.signOut/);
assert.match(app, /supabase\.auth\.getSession/);
assert.match(app, /supabase\.auth\.onAuthStateChange/);

// The new product must read/write the normalized tables, not the legacy onekan_state blob.
assert.match(app, /from\("structure_items"\)/);
assert.match(app, /from\("user_focus"\)/);
assert.doesNotMatch(app, /from\(["']onekan_state["']\)/);
assert.doesNotMatch(app, /demoStructure|const nextItems = \[/);

// Core CRUD and workflow operations.
assert.match(app, /\.insert\(payload\)\.select\(\)\.single\(\)/);
assert.match(app, /\.update\(payload\)\.eq\("id", id\)/);
assert.match(app, /\.delete\(\)\.eq\("id", item\.id\)/);
assert.match(app, /\.upsert\(\{ user_id: state\.user\.id, current_item_id: id \}/);
assert.match(app, /type: "next_step"/);
assert.match(app, /function openBreakdown\(/);
assert.match(app, /async function saveBreakdown\(/);
assert.match(app, /async function updateStatus\(/);

// Dynamic output is escaped before being injected into HTML.
assert.match(app, /function escapeHtml\(/);
assert.match(app, /escapeHtml\(item\.title\)/);

// Frontend may expose only the publishable key, never privileged secrets.
assert.match(supabase, /@supabase\/supabase-js@2\.116\.0/);
assert.match(supabase, /sb_publishable_/);
assert.doesNotMatch(supabase, /service_role|sb_secret_/i);

// Auth/CRUD-specific styles must be loaded and present.
assert.match(html, /\.\/css\/next-onekan-data\.css\?v=\d+/);
assert.match(dataCss, /\.nk-auth-gate/);
assert.match(dataCss, /\.nk-segmented/);
assert.match(dataCss, /\.nk-tree-toggle/);

console.log("next-onekan v0.1 regression: ok");
