const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Déploiement avec :", deployer.address);
  const registry = await (await hre.ethers.getContractFactory("DiplomaRegistry")).deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const artifact = await hre.artifacts.readArtifact("DiplomaRegistry");
  const chainId = (await hre.ethers.provider.getNetwork()).chainId.toString();
  // Lu par le serveur (server/index.js)
  fs.writeFileSync(path.join(__dirname, "..", "deployment.json"), JSON.stringify({ address, chainId, abi: artifact.abi }, null, 2));
  console.log("DiplomaRegistry déployé à :", address, "- deployment.json généré");
}
main().catch((e) => { console.error(e); process.exit(1); });
