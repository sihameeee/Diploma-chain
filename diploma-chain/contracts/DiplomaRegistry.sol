// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DiplomaRegistry
/// @notice Enregistre l'empreinte SHA-256 des diplômes PDF et permet de les vérifier.
/// @dev Le PDF n'est JAMAIS stocké on-chain : seulement son hash (32 octets).
contract DiplomaRegistry {
    /// Résultat de la vérification (les 3 situations demandées)
    enum Status { Unknown, Authentic, Modified }

    struct Diploma {
        bytes32 hash;      // empreinte SHA-256 du PDF
        uint256 issuedAt;  // horodatage du bloc
        address issuer;    // compte ayant enregistré le diplôme
        bool exists;
    }

    address public owner; // établissement autorisé à enregistrer
    mapping(bytes32 => Diploma) private diplomas; // clé = keccak256(identifiant)
    uint256 public totalDiplomas;

    event DiplomaRegistered(string id, bytes32 hash, address indexed issuer, uint256 issuedAt);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error EmptyId();
    error EmptyHash();
    error AlreadyRegistered(string id);
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Enregistre un diplôme (identifiant unique + hash). Immuable après coup.
    function registerDiploma(string calldata id, bytes32 hash) external onlyOwner {
        if (bytes(id).length == 0) revert EmptyId();
        if (hash == bytes32(0)) revert EmptyHash();
        bytes32 key = keccak256(bytes(id));
        if (diplomas[key].exists) revert AlreadyRegistered(id); // unicité de l'identifiant

        diplomas[key] = Diploma(hash, block.timestamp, msg.sender, true);
        totalDiplomas++;
        emit DiplomaRegistered(id, hash, msg.sender, block.timestamp);
    }

    /// @notice Compare le hash fourni à celui enregistré pour cet identifiant.
    /// @return Authentic si identique, Modified si l'id existe mais hash différent, Unknown sinon.
    function verifyDiploma(string calldata id, bytes32 hash) external view returns (Status) {
        Diploma storage d = diplomas[keccak256(bytes(id))];
        if (!d.exists) return Status.Unknown;
        return d.hash == hash ? Status.Authentic : Status.Modified;
    }

    /// @notice Détails d'un diplôme enregistré (pour affichage).
    function getDiploma(string calldata id)
        external view returns (bool exists, bytes32 hash, uint256 issuedAt, address issuer)
    {
        Diploma storage d = diplomas[keccak256(bytes(id))];
        return (d.exists, d.hash, d.issuedAt, d.issuer);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
