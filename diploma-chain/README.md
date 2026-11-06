# DiplomaChain v2 – Université de Béjaïa (Sujet 11, Sécurité Logicielle)

## Rôles
| Rôle | Accès | Droits |
|---|---|---|
| **Visiteur** | `/` (page publique) | Ajouter le PDF + identifiant et **vérifier** l'authenticité |
| **Employé** | `/admin.html` (login) | Enregistrer, vérifier, consulter les diplômes enregistrés |
| **Administrateur** | `/admin.html` (login) | Tout ce que fait l'employé + **créer / supprimer des utilisateurs** |

## Architecture
```
Navigateur (SHA-256 du PDF avec Ethers.js) → Serveur Express (login JWT, bcrypt)
   → signe avec la clé de l'université → smart contract DiplomaRegistry (Ganache)
```
Le PDF ne quitte jamais le navigateur : seule l'empreinte est envoyée. Le serveur détient la clé du compte « établissement » : **MetaMask n'est plus nécessaire**.

## Lancer (3 terminaux)
```bash
npm install
# Terminal 1
npx ganache --port 7545 --chain.chainId 1337 --wallet.deterministic
# Terminal 2 (une fois par démarrage de Ganache)
export GANACHE_PK=0x<clé privée du compte (0)>
npm run deploy:ganache
npm start                 # http://localhost:3000
```
Compte administrateur initial : `admin` / `Admin@2026`
(changer avant le 1er lancement : `ADMIN_USER=... ADMIN_PASSWORD=... npm start`).

Si Ganache est redémarré : relancer `npm run deploy:ganache`, puis `npm start`.
Réinitialiser les comptes : supprimer `data/users.json`.

## Sécurité
- Mots de passe hachés avec **bcrypt** ; sessions **JWT** (8 h) ; un compte supprimé perd immédiatement l'accès.
- Contrôle d'accès côté serveur (employé / admin), pas seulement dans l'interface.
- Limitation des tentatives de connexion (5 / minute / IP), validation des entrées, taille des requêtes limitée.
- Rendu de l'interface via `textContent` (pas d'injection HTML).
- Le contract interdit les doublons d'identifiant ; aucune fonction de modification ou suppression.
- Limites : en production, utiliser HTTPS, un vrai stockage (base de données) et une gestion sécurisée de la clé privée.
