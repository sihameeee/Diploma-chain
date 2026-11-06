const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DiplomaRegistry", () => {
  let registry, owner, other;
  const hashA = ethers.sha256(ethers.toUtf8Bytes("diplome-original"));
  const hashB = ethers.sha256(ethers.toUtf8Bytes("diplome-modifie"));

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory("DiplomaRegistry")).deploy();
  });

  it("enregistre un diplôme et émet l'événement", async () => {
    await expect(registry.registerDiploma("DIP-001", hashA)).to.emit(registry, "DiplomaRegistered");
    expect(await registry.totalDiplomas()).to.equal(1);
  });
  it("authentique : même id + même hash", async () => {
    await registry.registerDiploma("DIP-001", hashA);
    expect(await registry.verifyDiploma("DIP-001", hashA)).to.equal(1);
  });
  it("modifié : même id, hash différent", async () => {
    await registry.registerDiploma("DIP-001", hashA);
    expect(await registry.verifyDiploma("DIP-001", hashB)).to.equal(2);
  });
  it("inconnu : identifiant non enregistré", async () => {
    expect(await registry.verifyDiploma("DIP-999", hashA)).to.equal(0);
  });
  it("refuse un identifiant déjà utilisé", async () => {
    await registry.registerDiploma("DIP-001", hashA);
    await expect(registry.registerDiploma("DIP-001", hashB))
      .to.be.revertedWithCustomError(registry, "AlreadyRegistered");
  });
  it("refuse un compte non autorisé", async () => {
    await expect(registry.connect(other).registerDiploma("DIP-002", hashA))
      .to.be.revertedWithCustomError(registry, "NotOwner");
  });
  it("refuse id vide ou hash nul", async () => {
    await expect(registry.registerDiploma("", hashA)).to.be.revertedWithCustomError(registry, "EmptyId");
    await expect(registry.registerDiploma("X", ethers.ZeroHash)).to.be.revertedWithCustomError(registry, "EmptyHash");
  });
});
