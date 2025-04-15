# Diamond Pattern Implementation in OCP

The Open Cap Table Protocol (OCP) implements the Diamond pattern as its core architecture for smart contracts. This document explains how this pattern is implemented and its benefits.

## What is the Diamond Pattern?

The Diamond pattern is a modular smart contract architecture that allows for upgradeable contracts while maintaining a consistent storage layer. It addresses limitations of traditional smart contract design by providing:

- Modularity through multiple facets (implementation contracts)
- Upgradability without data migration
- Unlimited contract size beyond the 24KB limit
- Shared storage across all facets

## Core Components

### 1. Diamond Contract (CapTable)

The main entry point contract that delegates calls to various facets:
- Created by the `CapTableFactory` for each company's cap table
- Extends the base Diamond contract from the "diamond-3-hardhat" library
- Delegates function calls to appropriate facets based on function selectors

### 2. Diamond Storage

A shared storage structure that maintains all cap table data:
- Defined in `Storage.sol` with a comprehensive data model
- Uses a unique storage slot accessed via `StorageLib.get()`
- Contains issuer details, stakeholders, stock classes, and all position data
- Accessed by all facets using the same pointer location

```solidity
struct Storage {
    // Access Control storage
    mapping(bytes32 => mapping(address => bool)) roles;
    mapping(bytes32 => bytes32) roleAdmin;
    address currentAdmin;
    address pendingAdmin;
    
    // Cap Table storage
    Issuer issuer;
    bytes16[] stakeholders;
    mapping(bytes16 => uint256) stakeholderIndex;
    StockClass[] stockClasses;
    mapping(bytes16 => uint256) stockClassIndex;
    StockPlan[] stockPlans;
    mapping(bytes16 => uint256) stockPlanIndex;
    StockActivePositions stockActivePositions;
    ConvertibleActivePositions convertibleActivePositions;
    EquityCompensationActivePositions equityCompensationActivePositions;
    WarrantActivePositions warrantActivePositions;
    mapping(address => bytes16) addressToStakeholderId;
}
```

Storage is accessed using a unique storage slot:

```solidity
library StorageLib {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.storage");

    function get() internal pure returns (Storage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}
```

### 3. Facets

Specialized contracts that provide specific functionalities:

- `AccessControlFacet`: Manages permissions and roles
- `IssuerFacet`: Handles issuer-related operations
- `StakeholderFacet`: Manages stakeholder records
- `StockClassFacet`: Handles stock class configurations
- `StockFacet`: Manages stock issuance and transactions
- `StockPlanFacet`: Manages equity incentive plans
- `EquityCompensationFacet`: Handles equity compensation
- `ConvertiblesFacet`: Manages convertible securities
- `WarrantFacet`: Handles warrant securities
- `StakeholderNFTFacet`: Manages NFT representation of stakeholder positions

## Implementation Details

### Deployment Process

1. A reference diamond is deployed first with all facets
2. `CapTableFactory` creates new cap tables by:
   - Deploying a new `CapTable` contract
   - Copying facet selectors from the reference diamond
   - Initializing the access control system
   - Setting up the issuer configuration

```solidity
function createCapTable(bytes16 id, uint256 initialSharesAuthorized) external onlyOwner returns (address) {
    // Get DiamondCutFacet address from reference diamond
    DiamondLoupeFacet loupe = DiamondLoupeFacet(referenceDiamond);
    address diamondCutFacet = loupe.facetAddress(IDiamondCut.diamondCut.selector);

    // Create CapTable with factory as initial owner
    CapTable diamond = new CapTable(address(this), diamondCutFacet);

    // Get facet information from reference diamond
    IDiamondLoupe.Facet[] memory existingFacets = loupe.facets();

    // Create cuts array for valid facets
    IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](validFacetCount);
    
    // Copy facets from reference diamond
    for (uint256 i = 0; i < existingFacets.length; i++) {
        // Skip DiamondCut facet
        if (firstSelector != DiamondCutFacet.diamondCut.selector) {
            cuts[cutIndex] = IDiamondCut.FacetCut({
                facetAddress: existingFacets[i].facetAddress,
                action: IDiamondCut.FacetCutAction.Add,
                functionSelectors: existingFacets[i].functionSelectors
            });
        }
    }

    // Perform the cuts
    DiamondCutFacet(address(diamond)).diamondCut(cuts, address(0), "");

    // Initialize access control and issuer
    AccessControlFacet(address(diamond)).initializeAccessControl();
    IssuerFacet(address(diamond)).initializeIssuer(id, initialSharesAuthorized);
    
    return address(diamond);
}
```

### Function Selector Management

- DiamondCutFacet manages adding/replacing/removing functions
- Selectors are mapped to their implementation addresses
- Function calls are delegated to the appropriate facet using `delegatecall`

### Upgrade Process

- New facets can be deployed and added to the diamond
- Existing facets can be replaced with new implementations
- State is preserved during upgrades since storage remains at the same position

### Access Control

- Uses a role-based system implemented in `AccessControlFacet`
- Key roles include:
  - `ADMIN_ROLE`: Full control over the cap table
  - `OPERATOR_ROLE`: Can perform operations like issuing stock
  - `INVESTOR_ROLE`: Limited access for stakeholders

## Advantages in OCP Context

1. **Modularity**: Each facet handles a specific aspect of cap table management
2. **Upgradability**: Contract logic can be upgraded without migrating data
3. **Storage Efficiency**: All facets share the same storage
4. **Gas Optimization**: Only necessary functions are included in each transaction
5. **Simplified Interface**: Each facet presents a clear API for specific functionality

This architecture allows OCP to maintain a comprehensive on-chain cap table that can evolve over time while preserving the historical record and providing fine-grained access control to different stakeholders.
