const $ = (id) => document.getElementById(id);
let settings = { version: "latest-release", profile: "fabric", ramGb: 4, launcherPath: "" };
let versionManifest = null;
let savedProfiles = [];

async function loadVersions() {
  const select = $("version");
  select.innerHTML = "";
  try {
    versionManifest = await window.kclient.getVersions(false);
    const latest = document.createElement("option");
    latest.value = versionManifest.latestRelease;
    latest.textContent = `Uusin julkaisu — ${versionManifest.latestRelease}`;
    select.appendChild(latest);
    const releases = versionManifest.versions || [];
    for (const item of releases) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.id;
      select.appendChild(option);
    }
    $("version-count").textContent = `${releases.length} julkaisuversiota`;
    const profileVersion = $("new-profile-version");
    if (profileVersion) {
      profileVersion.replaceChildren();
      const latestProfileOption = document.createElement("option");
      latestProfileOption.value = versionManifest.latestRelease;
      latestProfileOption.textContent = `Uusin julkaisu — ${versionManifest.latestRelease}`;
      profileVersion.appendChild(latestProfileOption);
      for (const item of releases) {
        const option = document.createElement("option"); option.value = item.id; option.textContent = item.id;
        profileVersion.appendChild(option);
      }
    }
  } catch (error) {
    const option = document.createElement("option");
    option.value = "latest-release";
    option.textContent = "Versioiden haku epäonnistui — käytä virallista launcheria";
    select.appendChild(option);
    $("version-count").textContent = "Ei yhteyttä version manifestiin";
  }
}

function notify(message) { $("notice").textContent = message; }
function showPage(page) {
  $("home-page").classList.toggle("hidden", page !== "home");
  $("settings-page").classList.toggle("hidden", page !== "settings");
  $("profiles-page").classList.toggle("hidden", page !== "profiles");
  $("crumb-page").textContent = page === "home" ? "ETUSIVU" : page === "profiles" ? "PELIPROFIILIT" : "ASETUKSET";
  document.querySelectorAll(".nav").forEach(b => b.classList.toggle("active", b.dataset.page === page));
}
function currentSettings() {
  return {
    version: $("version").value,
    profile: $("profile").value,
    ramGb: Number($("ram").value),
    launcherPath: settings.launcherPath || ""
  };
}
async function saveSettings() {
  settings = { ...settings, ...currentSettings() };
  await window.kclient.saveSettings(settings);
  notify("Asetukset tallennettu tähän Windows-käyttäjäprofiiliin.");
}
async function loadProfiles() {
  savedProfiles = await window.kclient.listProfiles();
  const target = $("profile-target");
  target.replaceChildren();
  const list = $("profiles-list"); list.replaceChildren();
  for (const profile of savedProfiles) {
    const option = document.createElement("option"); option.value = profile.id;
    option.textContent = `${profile.name} — ${profile.version} · ${profile.loader}`;
    target.appendChild(option);
    const card = document.createElement("div"); card.className = "profile-card";
    const info = document.createElement("div"); info.className = "profile-card-info";
    const title = document.createElement("b"); title.textContent = profile.name;
    const meta = document.createElement("small"); meta.textContent = `${profile.version} · ${profile.loader.toUpperCase()} · ${profile.modsDirectory}`;
    info.append(title, meta);
    const actions = document.createElement("div"); actions.className = "profile-card-actions";
    const use = document.createElement("button"); use.className = "secondary"; use.textContent = "Valitse";
    use.addEventListener("click", () => { target.value = profile.id; applySelectedProfile(); showPage("home"); notify(`${profile.name} valittu modien kohdeprofiiliksi.`); });
    const folder = document.createElement("button"); folder.className = "secondary"; folder.textContent = "Avaa kansio";
    folder.addEventListener("click", async () => { await window.kclient.openProfileFolder(profile.id); });
    const del = document.createElement("button"); del.className = "secondary danger"; del.textContent = "Poista";
    del.disabled = savedProfiles.length <= 1;
    del.addEventListener("click", async () => {
      if (!confirm(`Poistetaanko profiili “${profile.name}” ja sen erillinen modikansio?`)) return;
      try { await window.kclient.deleteProfile(profile.id); await loadProfiles(); notify(`Profiili ${profile.name} poistettu.`); }
      catch (error) { notify(error.message); }
    });
    actions.append(use, folder, del); card.append(info, actions); list.append(card);
  }
  if (!savedProfiles.some(p => p.id === target.value)) target.value = savedProfiles[0]?.id || "";
  applySelectedProfile();
}
function applySelectedProfile() {
  const profile = savedProfiles.find(p => p.id === $("profile-target").value);
  if (!profile) return;
  $("profile").value = profile.loader;
  const matchingVersion = [...$("version").options].some(o => o.value === profile.version);
  if (matchingVersion) $("version").value = profile.version;
  else if (profile.version === "latest-release" && versionManifest?.latestRelease) $("version").value = versionManifest.latestRelease;
  $("launch-help").textContent = `${profile.name} · ${profile.version} · ${profile.loader}. Suora profiilin käynnistys on vielä kehitteillä.`;
}
async function init() {
  settings = { ...settings, ...(await window.kclient.readSettings()) };
  await loadVersions();
  if ([...$("version").options].some(option => option.value === settings.version)) {
    $("version").value = settings.version;
  }
  $("profile").value = settings.profile;
  $("ram").value = String(settings.ramGb || 4);
  $("launcher-path").textContent = settings.launcherPath || "Ei valittua tiedostoa";
  await loadProfiles();
}
document.querySelectorAll(".nav").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));
$("play").addEventListener("click", async () => {
  await saveSettings();
  const result = await window.kclient.openLauncher();
  notify(result.message);
});
$("login").addEventListener("click", async () => {
  const result = await window.kclient.openMicrosoftLogin();
  notify(result.message);
});
$("fabric").addEventListener("click", async () => {
  const result = await window.kclient.openFabricInstaller();
  notify(result.message);
});
$("choose-launcher").addEventListener("click", async () => {
  const chosen = await window.kclient.chooseLauncher();
  if (chosen) {
    settings.launcherPath = chosen;
    $("launcher-path").textContent = chosen;
    await saveSettings();
    notify("Minecraft Launcherin polku tallennettu.");
  }
});
$("save").addEventListener("click", saveSettings);
$("manage-profiles").addEventListener("click", () => showPage("profiles"));
$("profile-target").addEventListener("change", applySelectedProfile);
$("create-profile").addEventListener("click", async () => {
  const name = $("new-profile-name").value.trim();
  const version = $("new-profile-version").value || versionManifest?.latestRelease || "latest-release";
  const loader = $("new-profile-loader").value;
  try {
    const created = await window.kclient.createProfile({ name, version, loader });
    $("new-profile-name").value = "";
    await loadProfiles();
    $("profile-target").value = created.id;
    applySelectedProfile();
    notify(`Profiili “${created.name}” luotu. Modit asennetaan sen omaan kansioon.`);
  } catch (error) { notify(`Profiilin luonti epäonnistui: ${error.message}`); }
});
$("version").addEventListener("change", saveSettings);
$("profile").addEventListener("change", saveSettings);
$("ram").addEventListener("change", saveSettings);


let modCatalog = [];
async function loadModCatalog() {
  modCatalog = await window.kclient.getModCatalog();
  const list = $("mod-list");
  list.innerHTML = "";
  for (const mod of modCatalog) {
    const label = document.createElement("label");
    label.className = "mod-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = mod.slug;
    input.checked = Boolean(mod.recommended);
    const copy = document.createElement("span");
    copy.className = "mod-copy";
    const name = document.createElement("b"); name.textContent = mod.name;
    const desc = document.createElement("small"); desc.textContent = mod.description;
    const tag = document.createElement("span"); tag.className = "mod-tag"; tag.textContent = ({ performance: "FPS", pvp: "PVP", utility: "UTILITY", dependency: "LIBRARY", hud: "HUD", visuals: "VISUALS", polyfrost: "POLYFROST" })[mod.category] || "MOD";
    copy.append(name, desc);
    label.append(input, copy, tag);
    list.append(label);
  }
}
$("select-recommended").addEventListener("click", () => {
  document.querySelectorAll("#mod-list input[type=checkbox]").forEach(input => { const mod = modCatalog.find(item => item.slug === input.value); input.checked = Boolean(mod?.recommended); });
  notify("Suositellut modit valittu. Yhteensopivuus tarkistetaan asennuksessa.");
});
$("select-polyfrost").addEventListener("click", () => {
  document.querySelectorAll("#mod-list input[type=checkbox]").forEach(input => { const mod = modCatalog.find(item => item.slug === input.value); if (mod?.category === "polyfrost") input.checked = true; });
  notify("Polyfrost-modit valittu. Huomaa: osa niistä voi vaatia OneConfigin, joka on jätetty pois.");
});
$("clear-mods").addEventListener("click", () => document.querySelectorAll("#mod-list input[type=checkbox]").forEach(input => input.checked = false));

async function searchMods() {
  const query = $("mod-search-query").value.trim();
  const results = $("mod-search-results");
  if (query.length < 2) { results.innerHTML = '<div class="search-empty">Kirjoita vähintään kaksi merkkiä.</div>'; return; }
  const button = $("search-mods"); button.disabled = true; button.textContent = "Haetaan…";
  results.innerHTML = '<div class="search-empty">Haetaan Modrinthistä…</div>';
  try {
    const hits = await window.kclient.searchMods(query);
    results.replaceChildren();
    if (!hits.length) { results.innerHTML = '<div class="search-empty">Modeja ei löytynyt.</div>'; return; }
    for (const hit of hits) {
      const row = document.createElement("div"); row.className = "search-result";
      const copy = document.createElement("div"); copy.className = "search-result-copy";
      const name = document.createElement("b"); name.textContent = hit.name;
      const desc = document.createElement("small"); desc.textContent = `${hit.description} · ${hit.downloads.toLocaleString()} latausta`;
      copy.append(name, desc);
      const add = document.createElement("button"); add.className = "secondary";
      const already = [...document.querySelectorAll("#mod-list input")].some(input => input.value === hit.slug);
      add.textContent = already ? "Lisätty" : "Lisää"; add.disabled = already;
      add.addEventListener("click", () => {
        if (modCatalog.some(mod => mod.slug === hit.slug)) return;
        const mod = { slug: hit.slug, name: hit.name, description: hit.description || "Modrinthistä lisätty modi", category: "community", recommended: false };
        modCatalog.push(mod);
        const label = document.createElement("label"); label.className = "mod-item";
        const input = document.createElement("input"); input.type = "checkbox"; input.value = mod.slug; input.checked = true;
        const itemCopy = document.createElement("span"); itemCopy.className = "mod-copy";
        const itemName = document.createElement("b"); itemName.textContent = mod.name;
        const itemDesc = document.createElement("small"); itemDesc.textContent = mod.description;
        itemCopy.append(itemName, itemDesc);
        const tag = document.createElement("span"); tag.className = "mod-tag"; tag.textContent = "MODRINTH";
        label.append(input, itemCopy, tag); $("mod-list").prepend(label);
        add.textContent = "Lisätty"; add.disabled = true;
        notify(`${mod.name} lisätty asennusvalintaan. Paina lopuksi Lataa ja asenna valitut modit.`);
      });
      row.append(copy, add); results.append(row);
    }
  } catch (error) { results.innerHTML = `<div class="search-empty">Haku epäonnistui: ${String(error.message || error)}</div>`; }
  finally { button.disabled = false; button.textContent = "Hae"; }
}
$("search-mods").addEventListener("click", searchMods);
$("mod-search-query").addEventListener("keydown", event => { if (event.key === "Enter") searchMods(); });
$("install-mods").addEventListener("click", async () => {
  const version = $("version").value;
  if (!version || version === "latest-release") { notify("Valitse ensin tarkka Minecraft-versio."); return; }
  if ($("profile").value !== "fabric") { notify("Valitse client-profiiliksi Fabric ennen modien asennusta."); return; }
  const slugs = [...document.querySelectorAll("#mod-list input:checked")].map(input => input.value);
  const button = $("install-mods");
  button.disabled = true; button.textContent = "Ladataan modien versioita…";
  notify("Haetaan yhteensopivia Fabric-modeja Modrinthistä. Tämä voi kestää hetken.");
  try {
    const profileId = $("profile-target").value;
    const selectedProfile = savedProfiles.find(p => p.id === profileId);
    if (!selectedProfile) throw new Error("Luo tai valitse ensin profiili.");
    if (selectedProfile.loader !== "fabric") throw new Error("Valittu profiili on Vanilla. Valitse Fabric-profiili modien asennukseen.");
    if (selectedProfile.version !== "latest-release" && selectedProfile.version !== version) throw new Error("Valitun profiilin Minecraft-versio ei vastaa valittua versiota.");
    const result = await window.kclient.installMods({ version, slugs, profileId });
    const parts = [`Asennettu ${result.installed.length} .jar-tiedostoa kansioon ${result.modsDir}.`];
    if (result.skipped.length) parts.push(`Ei yhteensopivaa versiota: ${result.skipped.join(", ")}.`);
    if (result.errors.length) parts.push(`Virheitä: ${result.errors.join("; ")}`);
    notify(parts.join(" "));
  } catch (error) { notify(`Modien asennus epäonnistui: ${error.message}`); }
  finally { button.disabled = false; button.textContent = "Lataa ja asenna valitut modit"; }
});
const oldInit = init;
init = async function() { await oldInit(); try { await loadModCatalog(); } catch { notify("Modilistan lataus epäonnistui."); } };
init().catch(() => notify("Asetusten lataus epäonnistui."));
