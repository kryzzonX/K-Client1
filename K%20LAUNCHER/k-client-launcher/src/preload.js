const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kclient", {
  readSettings: () => ipcRenderer.invoke("settings:read"),
  getVersions: (includeSnapshots) => ipcRenderer.invoke("versions:list", includeSnapshots),
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  createProfile: (input) => ipcRenderer.invoke("profiles:create", input),
  updateProfile: (input) => ipcRenderer.invoke("profiles:update", input),
  deleteProfile: (id) => ipcRenderer.invoke("profiles:delete", id),
  openProfileFolder: (id) => ipcRenderer.invoke("profiles:open-folder", id),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  chooseLauncher: () => ipcRenderer.invoke("launcher:choose"),
  openLauncher: () => ipcRenderer.invoke("launcher:open"),
  openMicrosoftLogin: () => ipcRenderer.invoke("auth:open"),
  openFabricInstaller: () => ipcRenderer.invoke("fabric:open"),
  getModCatalog: () => ipcRenderer.invoke("mods:catalog"),
  searchMods: (query) => ipcRenderer.invoke("mods:search", query),
  installMods: (request) => ipcRenderer.invoke("mods:install", request)
});
