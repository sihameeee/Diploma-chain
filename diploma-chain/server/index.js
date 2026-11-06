// Serveur DiplomaChain : comptes (admin / employés) + passerelle vers la blockchain.
// Le serveur détient la clé de l'université et signe les transactions : MetaMask n'est plus nécessaire.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");
fs.mkdirSync(DATA, { recursive: true });
const PORT = process.env.PORT || 3000;
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")); } catch { return d; } };
const write = (f, v) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(v, null, 2));

// ---- Blockchain ----
if (!process.env.GANACHE_PK || !fs.existsSync(path.join(ROOT, "deployment.json"))) {
  console.error("Définissez GANACHE_PK et lancez d'abord `npm run deploy:ganache` (génère deployment.json).");
  process.exit(1);
}
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployment.json"), "utf8"));
const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL || "http://127.0.0.1:7545");
const signer = new ethers.NonceManager(new ethers.Wallet(process.env.GANACHE_PK, provider));
const contract = new ethers.Contract(dep.address, dep.abi, signer);

// ---- Secret JWT et administrateur initial ----
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  const p = path.join(DATA, "jwt.secret");
  if (!fs.existsSync(p)) fs.writeFileSync(p, crypto.randomBytes(32).toString("hex"));
  SECRET = fs.readFileSync(p, "utf8");
}
const users0 = read("users.json", []);
if (!users0.some((u) => u.role === "admin")) {
  const username = (process.env.ADMIN_USER || "admin").toLowerCase();
  const pwd = process.env.ADMIN_PASSWORD || "Admin@2026";
  users0.push({ username, hash: bcrypt.hashSync(pwd, 10), role: "admin", createdAt: new Date().toISOString() });
  write("users.json", users0);
  console.log(`Administrateur créé : ${username} / ${pwd}  (à changer en production)`);
}

// ---- Outils ----
const validId = (s) => typeof s === "string" && /^[\w.-]{3,64}$/.test(s);
const validHash = (s) => typeof s === "string" && /^0x[0-9a-fA-F]{64}$/.test(s);
const auth = (role) => (req, res, next) => {
  try {
    const p = jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), SECRET);
    const u = read("users.json", []).find((x) => x.username === p.sub); // un compte supprimé perd l'accès
    if (!u) throw new Error("no user");
    if (role && u.role !== role) return res.status(403).json({ error: "Accès réservé à l'administrateur." });
    req.user = u;
    next();
  } catch { res.status(401).json({ error: "Session expirée. Reconnectez-vous." }); }
};

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); next(); });
app.use(express.json({ limit: "10kb" }));
app.get("/vendor/ethers.js", (req, res) => res.sendFile(path.join(ROOT, "node_modules/ethers/dist/ethers.umd.min.js")));
app.use(express.static(path.join(ROOT, "frontend")));

// ---- Authentification (5 essais ratés / minute / IP) ----
const tries = new Map();
app.post("/api/login", (req, res) => {
  const t = tries.get(req.ip) || { n: 0, t: Date.now() };
  if (Date.now() - t.t > 60000) { t.n = 0; t.t = Date.now(); }
  if (t.n >= 5) return res.status(429).json({ error: "Trop de tentatives. Réessayez dans une minute." });
  const { username, password } = req.body || {};
  const u = read("users.json", []).find((x) => x.username === String(username || "").trim().toLowerCase());
  if (!u || !bcrypt.compareSync(String(password || ""), u.hash)) {
    t.n++; tries.set(req.ip, t);
    return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
  }
  tries.delete(req.ip);
  res.json({ token: jwt.sign({ sub: u.username }, SECRET, { expiresIn: "8h" }), user: { username: u.username, role: u.role } });
});
app.get("/api/me", auth(), (req, res) => res.json({ user: { username: req.user.username, role: req.user.role } }));

// ---- Gestion des utilisateurs (admin) ----
app.get("/api/users", auth("admin"), (req, res) =>
  res.json(read("users.json", []).map(({ username, role, createdAt }) => ({ username, role, createdAt }))));
app.post("/api/users", auth("admin"), (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = req.body?.role === "admin" ? "admin" : "employee";
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return res.status(400).json({ error: "Nom d'utilisateur : 3 à 32 caractères (lettres, chiffres, . _ -)." });
  if (password.length < 8) return res.status(400).json({ error: "Mot de passe : 8 caractères minimum." });
  const users = read("users.json", []);
  if (users.some((u) => u.username === username)) return res.status(409).json({ error: "Ce nom d'utilisateur existe déjà." });
  users.push({ username, hash: bcrypt.hashSync(password, 10), role, createdAt: new Date().toISOString() });
  write("users.json", users);
  res.status(201).json({ ok: true });
});
app.delete("/api/users/:username", auth("admin"), (req, res) => {
  if (req.params.username === req.user.username) return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
  const users = read("users.json", []);
  if (!users.some((u) => u.username === req.params.username)) return res.status(404).json({ error: "Utilisateur introuvable." });
  write("users.json", users.filter((u) => u.username !== req.params.username));
  res.json({ ok: true });
});

// ---- Diplômes ----
app.post("/api/diplomas", auth(), async (req, res) => {
  const { id, hash } = req.body || {};
  if (!validId(id) || !validHash(hash)) return res.status(400).json({ error: "Identifiant ou empreinte invalide." });
  try {
    if ((await contract.getDiploma(id))[0]) return res.status(409).json({ error: "Cet identifiant est déjà enregistré." });
    const tx = await contract.registerDiploma(id, hash);
    const rc = await tx.wait();
    const log = read("diplomas.json", []);
    const entry = { id, hash, by: req.user.username, at: new Date().toISOString(), tx: tx.hash, block: rc.blockNumber };
    log.push(entry); write("diplomas.json", log);
    res.status(201).json(entry);
  } catch (e) { console.error(e.shortMessage || e.message); res.status(503).json({ error: "Échec de l'enregistrement sur la blockchain." }); }
});
app.get("/api/diplomas", auth(), (req, res) => res.json(read("diplomas.json", []).reverse()));

// Vérification publique : 0 inconnu, 1 authentique, 2 modifié
app.post("/api/verify", async (req, res) => {
  const { id, hash } = req.body || {};
  if (!validId(id) || !validHash(hash)) return res.status(400).json({ error: "Identifiant ou empreinte invalide." });
  try {
    const status = Number(await contract.verifyDiploma(id, hash));
    const out = { status };
    if (status === 1) out.issuedAt = Number((await contract.getDiploma(id))[2]);
    res.json(out);
  } catch { res.status(503).json({ error: "Blockchain injoignable. Réessayez plus tard." }); }
});

app.use((err, req, res, next) => res.status(400).json({ error: "Requête invalide." }));
app.listen(PORT, () => console.log(`DiplomaChain : http://localhost:${PORT}  (admin : /admin.html)`));
