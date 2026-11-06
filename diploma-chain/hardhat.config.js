require("@nomicfoundation/hardhat-toolbox");

// Clé privée du compte Ganache qui sera l'établissement (propriétaire du contract).
// Ganache -> icône clé à côté du compte -> copier la clé privée.
// Windows: set GANACHE_PK=0x...   |  Linux/Mac: export GANACHE_PK=0x...
const GANACHE_PK = process.env.GANACHE_PK;

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
    // Ganache GUI: port 7545, chainId 1337 | Ganache CLI: port 8545
    ganache: {
      url: process.env.GANACHE_URL || "http://127.0.0.1:7545",
      chainId: 1337,
      accounts: GANACHE_PK ? [GANACHE_PK] : [],
    },
  },
};
