const fragment = new URLSearchParams(location.hash.slice(1));
const token = fragment.get("token") || sessionStorage.getItem("openiot-manager-token");
history.replaceState(null, "", location.pathname);
if (token) sessionStorage.setItem("openiot-manager-token", token);
const message = document.querySelector("#message");
let operating = false;
async function api(path, method = "GET", data) {
  const response = await fetch("/api/" + path, { method, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw Error(detail.error || (response.status === 401 ? "Open ‘Open IoT Server Setup’ from the Start Menu to authorize this page." : "Server request failed."));
  }
  return response.json();
}
async function refresh() {
  const status = await api("status");
  document.querySelector("#setup").hidden = status.setupComplete;
  document.querySelector("#management").hidden = !status.setupComplete;
  document.querySelector("#state").textContent = status.running ? "Dashboard is running." : "Dashboard is starting.";
  document.querySelector("#dashboard").href = status.settings.origin + "/dashboard";
  document.querySelector("#data-path").textContent = "Server data: " + status.dataDir;
  const form = document.querySelector("#settings");
  for (const [key, value] of Object.entries(status.settings)) {
    if (typeof value === "boolean") form.elements[key].checked = value;
    else form.elements[key].value = value;
  }
  const list = document.querySelector("#backups");
  list.replaceChildren();
  for (const backup of status.backups) {
    const item = document.createElement("li"), button = document.createElement("button");
    item.append(document.createTextNode(new Date(backup.createdAt).toLocaleString() + " "));
    button.textContent = "Restore";
    button.onclick = () => {
      if (prompt("This replaces the current database. Type RESTORE to continue.") !== "RESTORE") return;
      void operation(async () => { await api("restore", "POST", { id: backup.id, confirm: "RESTORE" }); await refresh(); }, "Backup restored. Sign in to your dashboard again.");
    };
    item.append(button); list.append(item);
  }
}
async function operation(work, success) {
  if (operating) return;
  operating = true;
  document.querySelectorAll("button").forEach(b => b.disabled = true);
  message.textContent = "Working… please keep this page open.";
  try { await work(); message.textContent = success; }
  catch (error) { message.textContent = error.message; }
  finally { operating = false; document.querySelectorAll("button").forEach(b => b.disabled = false); }
}
document.querySelector("#account").onsubmit = event => {
  event.preventDefault();
  void operation(async () => { await api("setup", "POST", Object.fromEntries(new FormData(event.target))); event.target.reset(); await refresh(); }, "Account created. Your server is ready.");
};
document.querySelector("#settings").onsubmit = event => {
  event.preventDefault();
  const form = event.target;
  const data = { origin: form.elements.origin.value.trim() };
  for (const key of ["lanAccess", "mqttEnabled", "registrationEnabled", "voiceEnabled"]) data[key] = form.elements[key].checked;
  void operation(async () => { await api("settings", "PUT", data); await refresh(); }, "Settings saved. Dashboard restarted.");
};
document.querySelector("#backup").onclick = () => operation(async () => { await api("backups", "POST", {}); await refresh(); }, "Backup saved.");
void operation(refresh, "Connected to your local server.");
