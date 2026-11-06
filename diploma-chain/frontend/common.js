const $ = (s, r = document) => r.querySelector(s);
const h = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); kids.flat().forEach((k) => e.append(k)); return e; };
// Empreinte SHA-256 calculée dans le navigateur : le PDF ne quitte pas l'ordinateur
const hashFile = async (f) => ethers.sha256(new Uint8Array(await f.arrayBuffer()));
const fmt = (s) => new Date(s).toLocaleString("fr-FR");
const genId = () => {
  const r = crypto.getRandomValues(new Uint8Array(4));
  return "DIP-" + new Date().getFullYear() + "-" + Array.from(r, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
};

async function api(path, { method = "GET", body } = {}) {
  const token = sessionStorage.getItem("token");
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || "Erreur serveur"); e.status = r.status; throw e; }
  return j;
}
function show(el, cls, title, lines = []) {
  el.replaceChildren(h("div", { className: "result " + cls }, h("h2", { textContent: title }), ...lines.map((l) => h("p", { textContent: l }))));
}
function filePick(root, onHash) {
  const input = $(".file", root), name = $(".fname", root), hash = $(".hash", root);
  input.onchange = async () => {
    const f = input.files[0];
    onHash(null); hash.classList.add("hidden");
    if (!f) return;
    name.textContent = f.name;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { name.textContent = "Le fichier doit être un PDF."; return; }
    const hx = await hashFile(f);
    hash.textContent = "SHA-256 : " + hx; hash.classList.remove("hidden"); onHash(hx);
  };
}
const FILE_FIELD = `<label>Fichier PDF du diplôme<span class="drop"><span class="fname">Choisir ou déposer un fichier PDF</span><input type="file" class="file" accept="application/pdf,.pdf"></span></label><div class="hash hidden"></div>`;

// ---- Vérifier (public + personnel) ----
function verifyPanel(root) {
  root.innerHTML = `<label>Identifiant du diplôme<input type="text" class="id" placeholder="ex. DIP-2026-A1B2C3D4" autocomplete="off"></label>${FILE_FIELD}
  <p><button class="btn go" disabled>Vérifier le diplôme</button></p><div class="out" aria-live="polite"></div>`;
  let hx = null; const id = $(".id", root), go = $(".go", root), out = $(".out", root);
  const sync = () => (go.disabled = !(hx && id.value.trim()));
  filePick(root, (v) => { hx = v; sync(); }); id.oninput = sync;
  go.onclick = async () => {
    go.disabled = true;
    try {
      const r = await api("/api/verify", { method: "POST", body: { id: id.value.trim(), hash: hx } });
      if (r.status === 1) show(out, "ok", "Diplôme authentique", ["L’empreinte du fichier correspond à celle enregistrée sur la blockchain.", "Enregistré le " + fmt(r.issuedAt * 1000)]);
      else if (r.status === 2) show(out, "ko", "Diplôme modifié", ["Cet identifiant existe, mais le contenu du fichier diffère de l’original enregistré.", "Le document a été altéré ou n’est pas la version d’origine."]);
      else show(out, "unk", "Diplôme inconnu", ["Aucun diplôme n’est enregistré sous cet identifiant.", "Vérifiez l’identifiant, ou le document n’a jamais été enregistré."]);
    } catch (e) { show(out, "warn", "Vérification impossible", [e.message]); }
    sync();
  };
}

// ---- Enregistrer (personnel connecté) ----
function registerPanel(root) {
  root.innerHTML = `<label>Identifiant unique du diplôme</label><div class="row"><input type="text" class="id" autocomplete="off"><button class="btn ghost gen" type="button">Générer</button></div>${FILE_FIELD}
  <p><button class="btn go" disabled>Enregistrer sur la blockchain</button></p><div class="out" aria-live="polite"></div>`;
  let hx = null; const id = $(".id", root), go = $(".go", root), out = $(".out", root);
  id.value = genId();
  const sync = () => (go.disabled = !(hx && id.value.trim()));
  filePick(root, (v) => { hx = v; sync(); }); id.oninput = sync;
  $(".gen", root).onclick = () => { id.value = genId(); sync(); };
  go.onclick = async () => {
    go.disabled = true; show(out, "unk", "Enregistrement en cours…", ["Validation du bloc sur la blockchain."]);
    try {
      const r = await api("/api/diplomas", { method: "POST", body: { id: id.value.trim(), hash: hx } });
      show(out, "ok", "Diplôme enregistré", ["Identifiant : " + r.id + " (à communiquer au diplômé)", "Bloc n° " + r.block + " · transaction " + r.tx]);
    } catch (e) { show(out, "ko", "Enregistrement refusé", [e.message]); }
    sync();
  };
}
