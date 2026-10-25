const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const os = require("node:os");
const crypto = require("node:crypto");

let win;
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
const profilesPath = () => path.join(app.getPath("userData"), "profiles.json");
const profileRoot = () => path.join(app.getPath("userData"), "profiles");
function cleanProfileName(value) {
  const name = String(value || "").trim().replace(/[<>:"/\\\\|?*\\x00-\\x1f]/g, "").slice(0, 40);
  if (!name) throw new Error("Anna profiilille nimi.");
  return name;
}
function readProfiles() {
  try {
    const stored = JSON.parse(fs.readFileSync(profilesPath(), "utf8"));
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {}
  const defaults = [
    { id: "k-pvp", name: "K PvP", version: "latest-release", loader: "fabric", createdAt: Date.now() },
    { id: "k-vanilla", name: "K Vanilla", version: "latest-release", loader: "vanilla", createdAt: Date.now() }
  ];
  writeProfiles(defaults);
  return defaults;
}
function writeProfiles(profiles) {
  fs.mkdirSync(path.dirname(profilesPath()), { recursive: true });
  fs.writeFileSync(profilesPath(), JSON.stringify(profiles, null, 2), "utf8");
}
function profileDir(id) {
  if (!/^[a-z0-9-]{1,48}$/.test(String(id || ""))) throw new Error("Virheellinen profiilitunnus.");
  const profile = readProfiles().find(item => item.id === id);
  if (!profile) throw new Error("Profiilia ei löytynyt.");
  return path.join(profileRoot(), profile.id);
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), "utf8")); }
  catch { return { version: "latest-release", profile: "vanilla", ramGb: 4, launcherPath: "" }; }
}
function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), "utf8");
  return true;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 740, minWidth: 900, minHeight: 620,
    backgroundColor: "#0c0914",
    title: "K Client Launcher",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, "index.html"));
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });


ipcMain.handle("profiles:list", () => readProfiles().map(item => ({
  ...item, directory: profileDir(item.id), modsDirectory: path.join(profileDir(item.id), "mods")
})));
ipcMain.handle("profiles:create", (_event, input) => {
  const name = cleanProfileName(input?.name);
  const version = String(input?.version || "latest-release").slice(0, 80);
  const loader = input?.loader === "vanilla" ? "vanilla" : "fabric";
  const profiles = readProfiles();
  if (profiles.length >= 30) throw new Error("Profiileja voi olla enintään 30.");
  const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "profile"}-${crypto.randomBytes(4).toString("hex")}`;
  const profile = { id, name, version, loader, createdAt: Date.now() };
  profiles.push(profile);
  writeProfiles(profiles);
  fs.mkdirSync(path.join(profileRoot(), id, "mods"), { recursive: true });
  return { ...profile, directory: profileDir(id), modsDirectory: path.join(profileDir(id), "mods") };
});
ipcMain.handle("profiles:update", (_event, input) => {
  const id = String(input?.id || "");
  const profiles = readProfiles();
  const index = profiles.findIndex(item => item.id === id);
  if (index < 0) throw new Error("Profiilia ei löytynyt.");
  profiles[index] = { ...profiles[index], name: cleanProfileName(input?.name), version: String(input?.version || profiles[index].version).slice(0, 80), loader: input?.loader === "vanilla" ? "vanilla" : "fabric" };
  writeProfiles(profiles);
  return profiles[index];
});
ipcMain.handle("profiles:delete", (_event, idValue) => {
  const id = String(idValue || "");
  const profiles = readProfiles();
  if (profiles.length <= 1) throw new Error("Viimeistä profiilia ei voi poistaa.");
  const index = profiles.findIndex(item => item.id === id);
  if (index < 0) throw new Error("Profiilia ei löytynyt.");
  const dir = profileDir(id);
  profiles.splice(index, 1);
  writeProfiles(profiles);
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
});
ipcMain.handle("profiles:open-folder", async (_event, id) => {
  const dir = profileDir(id);
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
  return dir;
});

ipcMain.handle("versions:list", async (_event, includeSnapshots = false) => {
  const endpoint = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Minecraft version manifest returned ${response.status}`);
  const manifest = await response.json();
  const allowedTypes = includeSnapshots
    ? new Set(["release", "snapshot", "old_beta", "old_alpha"])
    : new Set(["release"]);
  return {
    latestRelease: manifest.latest?.release || "",
    latestSnapshot: manifest.latest?.snapshot || "",
    versions: (manifest.versions || [])
      .filter(v => allowedTypes.has(v.type))
      .map(v => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }))
  };
});

ipcMain.handle("settings:read", () => readSettings());
ipcMain.handle("settings:save", (_event, settings) => {
  const safe = {
    version: String(settings.version || "latest-release").slice(0, 80),
    profile: ["vanilla", "fabric"].includes(settings.profile) ? settings.profile : "vanilla",
    ramGb: Math.max(2, Math.min(16, Number(settings.ramGb) || 4)),
    launcherPath: String(settings.launcherPath || "").slice(0, 1024)
  };
  return writeSettings(safe);
});
ipcMain.handle("launcher:choose", async () => {
  const result = await dialog.showOpenDialog(win, {
    title: "Valitse virallinen Minecraft Launcher",
    properties: ["openFile"],
    filters: [{ name: "Windows-sovellus", extensions: ["exe"] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});
ipcMain.handle("launcher:open", async () => {
  const settings = readSettings();
  // Never use minecraft:// here: Windows may route that URI to Bedrock.
  // Launch only an explicitly selected desktop launcher executable.
  if (settings.launcherPath && fs.existsSync(settings.launcherPath)) {
    const child = spawn(settings.launcherPath, [], { detached: true, stdio: "ignore" });
    child.unref();
    return { ok: true, message: "Minecraft Launcher avattiin. Valitse Minecraft: Java Edition ja oikea Fabric-profiili. K Client ei vielä käynnistä valittua profiilia suoraan." };
  }
  await shell.openExternal("https://www.minecraft.net/en-us/download");
  return { ok: false, message: "Bedrockin avaamisen estämiseksi automaattinen minecraft://-linkki poistettiin. Asenna virallinen Minecraft Launcher Java Editionille ja valitse sen .exe Asetuksista." };
});
ipcMain.handle("auth:open", async () => {
  await shell.openExternal("https://www.minecraft.net/login");
  return { ok: true, message: "Kirjaudu Microsoft-tilillä virallisessa Minecraft-palvelussa tai launcherissa. K Client ei pyydä eikä tallenna salasanaasi." };
});
ipcMain.handle("fabric:open", async () => {
  await shell.openExternal("https://fabricmc.net/use/installer/");
  return { ok: true, message: "Fabric Installer avattiin. Asenna haluamasi Minecraft-versio Fabricille, avaa sitten Minecraft Launcher ja valitse Fabric-profiili." };
});
ipcMain.handle("app:openUrl", async (_event, url) => {
  const allowed = ["https://docs.fabricmc.net/", "https://fabricmc.net/", "https://www.minecraft.net/"];
  if (typeof url === "string" && allowed.some(prefix => url.startsWith(prefix))) await shell.openExternal(url);
});


const MODRINTH_API = "https://api.modrinth.com/v2";
const MOD_CATALOG = [
  { slug: "sodium", name: "Sodium", description: "FPS ja renderöinnin optimointi", category: "performance", recommended: true },
  { slug: "lithium", name: "Lithium", description: "Pelilogiikan optimointi", category: "performance", recommended: true },
  { slug: "ferrite-core", name: "FerriteCore", description: "Pienempi muistinkäyttö", category: "performance", recommended: true },
  { slug: "entityculling", name: "Entity Culling", description: "Ohittaa näkymättömien entiteettien renderöinnin", category: "performance", recommended: true },
  { slug: "immediatelyfast", name: "ImmediatelyFast", description: "UI- ja renderöintiparannuksia", category: "performance", recommended: true },
  { slug: "dynamic-fps", name: "Dynamic FPS", description: "Vähentää kuormaa taustalla", category: "performance", recommended: true },
  { slug: "modernfix", name: "ModernFix", description: "Muisti-, käynnistys- ja suorituskykyoptimointeja", category: "performance", recommended: true },
  { slug: "krypton", name: "Krypton", description: "Verkkopinon optimointi", category: "performance", recommended: true },
  { slug: "noisium", name: "Noisium", description: "Maaston generoinnin optimointeja", category: "performance", recommended: true },
  { slug: "moreculling", name: "More Culling", description: "Lisää culling-optimointeja", category: "performance", recommended: true },
  { slug: "badoptimizations", name: "BadOptimizations", description: "Pieniä suorituskykykorjauksia", category: "performance", recommended: true },
  { slug: "enhanced-block-entities", name: "Enhanced Block Entities", description: "Tehostaa joidenkin block entityjen renderöintiä", category: "performance", recommended: true },
  { slug: "c2me-fabric", name: "C2ME", description: "Rinnakkaistaa chunkien latausta/generointia; kokeellinen", category: "performance", recommended: false },
  { slug: "debugify", name: "Debugify", description: "Korjaa valikoituja Minecraft-bugeja", category: "utility", recommended: true },
  { slug: "zoomify", name: "Zoomify", description: "Säädettävä zoom-toiminto", category: "pvp", recommended: true },
  { slug: "xaeros-minimap", name: "Xaero's Minimap", description: "Minimap ja waypointit", category: "utility", recommended: true },
  { slug: "xaeros-world-map", name: "Xaero's World Map", description: "Koko maailman kartta", category: "utility", recommended: true },
  { slug: "modmenu", name: "Mod Menu", description: "Modien asetukset pelissä", category: "utility", recommended: true },
  { slug: "fabric-api", name: "Fabric API", description: "Monien Fabric-modien vaatima kirjasto", category: "dependency", recommended: true },
  { slug: "appleskin", name: "AppleSkin", description: "Nälkä- ja saturaatio-HUD", category: "hud", recommended: true },
  { slug: "betterf3", name: "BetterF3", description: "Muokattava debug-näkymä", category: "hud", recommended: true },
  { slug: "chat-heads", name: "Chat Heads", description: "Pelaajien päät chat-viesteissä", category: "hud", recommended: true },
  { slug: "no-chat-reports", name: "No Chat Reports", description: "Chat-raportoinnin yksityisyysasetuksia", category: "utility", recommended: true },
  { slug: "inventory-profiles-next", name: "Inventory Profiles Next", description: "Inventaarion järjestelytyökaluja", category: "utility", recommended: false },
  { slug: "iris", name: "Iris Shaders", description: "Shader-tuki (voi vaikuttaa FPS:ään)", category: "visuals", recommended: false },
  { slug: "lambdynamiclights", name: "LambDynamicLights", description: "Dynaaminen valaistus", category: "visuals", recommended: false },
  { slug: "continuity", name: "Continuity", description: "Yhdistetyt tekstuurit resource packeille", category: "visuals", recommended: false },
  { slug: "shulkerboxtooltip", name: "ShulkerBoxTooltip", description: "Shulker-laatikon sisältö tooltipissä", category: "utility", recommended: true },
  { slug: "evergreenhud", name: "EvergreenHUD", description: "Polyfrostin HUD-kokonaisuus; tarkista riippuvuudet", category: "polyfrost", recommended: false },
  { slug: "vanillahud", name: "VanillaHUD", description: "Vanilla-HUDin muokkaus Polyfrostilta", category: "polyfrost", recommended: false },
  { slug: "polyblur", name: "PolyBlur", description: "Polyfrostin blur-efekti", category: "polyfrost", recommended: false },
  { slug: "polysprint", name: "PolySprint", description: "Toggle sprint -modi; saatavuus vaihtelee", category: "polyfrost", recommended: false },
  { slug: "chatting", name: "Chatting", description: "Polyfrostin chat-parannuksia", category: "polyfrost", recommended: false },
  { slug: "tooltip-scroll", name: "Tooltip Scroll", description: "Tooltip-tekstien vieritys Polyfrost-yhteisön modina", category: "polyfrost", recommended: false }
];

const BLOCKED_MOD_SLUGS = new Set(["oneconfig"]);
const modrinthHeaders = { "User-Agent": "KClientLauncher/0.2 (community launcher)" };
ipcMain.handle("mods:search", async (_event, rawQuery) => {
  const query = String(rawQuery || "").trim().slice(0, 100);
  if (query.length < 2) return [];
  const facets = JSON.stringify([["project_type:mod"]]);
  const url = `${MODRINTH_API}/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(facets)}&limit=20`;
  const response = await fetch(url, { headers: modrinthHeaders });
  if (!response.ok) throw new Error(`Modrinth-haku epäonnistui: ${response.status}`);
  const body = await response.json();
  return (body.hits || []).filter(p => p.project_type === "mod" && !BLOCKED_MOD_SLUGS.has(String(p.slug).toLowerCase())).map(p => ({
    slug: String(p.slug || ""), name: String(p.title || p.slug || "Mod"),
    description: String(p.description || "").slice(0, 240), downloads: Number(p.downloads || 0),
    categories: Array.isArray(p.categories) ? p.categories : [],
    iconUrl: typeof p.icon_url === "string" ? p.icon_url : ""
  })).filter(p => /^[a-z0-9_-]{2,100}$/i.test(p.slug));
});

ipcMain.handle("mods:catalog", () => MOD_CATALOG);
ipcMain.handle("mods:install", async (_event, request) => {
  const version = String(request?.version || "").trim();
  const selected = Array.isArray(request?.slugs) ? [...new Set(request.slugs.map(slug => String(slug)))].filter(slug => /^[a-z0-9_-]{2,100}$/i.test(slug) && !BLOCKED_MOD_SLUGS.has(slug.toLowerCase())) : [];
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(version)) throw new Error("Valitse ensin tarkka Minecraft-julkais versio.");
  if (!selected.length) throw new Error("Valitse vähintään yksi modi.");

  const targetProfileId = String(request?.profileId || "");
  const targetProfile = readProfiles().find(item => item.id === targetProfileId);
  if (!targetProfile) throw new Error("Valitse ensin tallennettu peliprofiili.");
  if (targetProfile.loader !== "fabric") throw new Error("Modit voi asentaa vain Fabric-profiiliin.");
  if (targetProfile.version !== "latest-release" && targetProfile.version !== version) throw new Error("Valittu Minecraft-versio ei vastaa profiilin versiota. Päivitä profiilin versio ensin.");
  const modsDir = path.join(profileDir(targetProfileId), "mods");
  fs.mkdirSync(modsDir, { recursive: true });
  const queue = [...selected];
  const seen = new Set();
  const installed = [];
  const skipped = [];
  const errors = [];
  while (queue.length) {
    const slug = queue.shift();
    if (BLOCKED_MOD_SLUGS.has(String(slug).toLowerCase())) { skipped.push(`${slug} (OneConfig on rajattu pois)`); continue; }
    if (seen.has(slug)) continue;
    seen.add(slug);
    try {
      const endpoint = `${MODRINTH_API}/project/${encodeURIComponent(slug)}/version?game_versions=${encodeURIComponent(JSON.stringify([version]))}&loaders=${encodeURIComponent(JSON.stringify(["fabric"]))}`;
      const resp = await fetch(endpoint, { headers: modrinthHeaders });
      if (!resp.ok) throw new Error(`Modrinth API: ${resp.status}`);
      const versions = await resp.json();
      if (!versions.length) { skipped.push(slug); continue; }
      const compatible = versions.find(v => v.status === "listed") || versions[0];
      for (const dep of (compatible.dependencies || [])) {
        if (dep.dependency_type === "required" && dep.project_id) {
          try {
            const pr = await fetch(`${MODRINTH_API}/project/${encodeURIComponent(dep.project_id)}`, { headers: modrinthHeaders });
            if (pr.ok) { const project = await pr.json(); if (project.slug && !seen.has(project.slug) && !BLOCKED_MOD_SLUGS.has(String(project.slug).toLowerCase())) queue.push(project.slug); else if (BLOCKED_MOD_SLUGS.has(String(project.slug || "").toLowerCase())) skipped.push(`${slug} (vaatii OneConfigin, jota ei asenneta)`); }
          } catch {}
        }
      }
      const file = (compatible.files || []).find(f => f.primary) || (compatible.files || []).find(f => f.filename?.endsWith(".jar"));
      if (!file || !file.filename?.endsWith(".jar")) throw new Error("Modilta puuttuu .jar-tiedosto");
      const downloadUrl = new URL(file.url);
      if (downloadUrl.protocol !== "https:" || !["cdn.modrinth.com", "cdn-raw.modrinth.com"].includes(downloadUrl.hostname)) throw new Error("Latausosoite ei ole sallittu");
      const download = await fetch(downloadUrl);
      if (!download.ok) throw new Error(`Lataus epäonnistui: ${download.status}`);
      const bytes = Buffer.from(await download.arrayBuffer());
      if (bytes.length < 100 || bytes.length > 100 * 1024 * 1024) throw new Error("Tiedoston koko ei ole kelvollinen");
      if (file.hashes?.sha512) {
        const actualHash = crypto.createHash("sha512").update(bytes).digest("hex");
        if (actualHash.toLowerCase() !== String(file.hashes.sha512).toLowerCase()) throw new Error("SHA-512-tarkistus epäonnistui; tiedostoa ei asennettu");
      } else if (file.hashes?.sha1) {
        const actualHash = crypto.createHash("sha1").update(bytes).digest("hex");
        if (actualHash.toLowerCase() !== String(file.hashes.sha1).toLowerCase()) throw new Error("SHA-1-tarkistus epäonnistui; tiedostoa ei asennettu");
      } else {
        throw new Error("Lähde ei toimittanut tarkistussummaa; tiedostoa ei asennettu");
      }
      const safeName = path.basename(file.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      const target = path.join(modsDir, safeName);
      const tempTarget = `${target}.kclient-tmp`;
      fs.writeFileSync(tempTarget, bytes, { flag: "w" });
      fs.renameSync(tempTarget, target);
      installed.push(safeName);
    } catch (e) { errors.push(`${slug}: ${e.message}`); }
  }
  return { modsDir, installed, skipped, errors };
});
