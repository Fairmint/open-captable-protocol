// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@core/CapTable.sol";
import { CapTableFactory } from "@core/CapTableFactory.sol";
import "@facets/IssuerFacet.sol";
import { StakeholderFacet } from "@facets/StakeholderFacet.sol";
import { StockClassFacet } from "@facets/StockClassFacet.sol";
import { StockFacet } from "@facets/StockFacet.sol";
import { ConvertiblesFacet } from "@facets/ConvertiblesFacet.sol";
import { EquityCompensationFacet } from "@facets/EquityCompensationFacet.sol";
import { StockPlanFacet } from "@facets/StockPlanFacet.sol";
import { WarrantFacet } from "@facets/WarrantFacet.sol";
import { StakeholderNFTFacet } from "@facets/StakeholderNFTFacet.sol";
import { AccessControlFacet } from "@facets/AccessControlFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import "../script/DeployFactory.s.sol";

contract DiamondTestBase is Test {
    uint256 public issuerInitialSharesAuthorized = 1_000_000;
    bytes16 public issuerId = 0xd3373e0a4dd9430f8a563281f2800e1e;
    address public contractOwner;
    address public referenceDiamond;
    CapTable public capTable;
    CapTableFactory public factory;

    event StockIssued(
        bytes16 indexed stakeholderId, bytes16 indexed stockClassId, uint256 quantity, uint256 sharePrice
    );
    event StakeholderCreated(bytes16 indexed id);
    event StockClassCreated(
        bytes16 indexed id, string indexed classType, uint256 indexed pricePerShare, uint256 initialSharesAuthorized
    );
    event StockPlanCreated(bytes16 indexed id, uint256 shares_reserved);
    // TOOD: figure out if should use the facets' events?
    event IssuerAuthorizedSharesAdjusted(uint256 newSharesAuthorized);
    event StockClassAuthorizedSharesAdjusted(bytes16 indexed stockClassId, uint256 newSharesAuthorized);
    event StockPlanSharesReservedAdjusted(bytes16 indexed id, uint256 newSharesReserved);

    function setUp() public virtual {
        // Create a wallet address to be the owner (simulating a real deployment)
        contractOwner = makeAddr("owner");
        console.log("contractOwner wallet: ", contractOwner);
        console.log("test contract address: ", address(this));

        // Start broadcast as the contract owner
        vm.startPrank(contractOwner);

        // Deploy the diamond cut facet first
        DiamondCutFacet diamondCutFacet = new DiamondCutFacet();
        console.log("DiamondCutFacet created at: ", address(diamondCutFacet));

        // Create reference diamond with contract owner as owner
        referenceDiamond = address(new CapTable(contractOwner, address(diamondCutFacet)));
        console.log("Reference diamond created at: ", referenceDiamond);

        // Deploy all other facets
        (
            DiamondLoupeFacet diamondLoupeFacet,
            IssuerFacet issuerFacet,
            StakeholderFacet stakeholderFacet,
            StockClassFacet stockClassFacet,
            StockFacet stockFacet,
            ConvertiblesFacet convertiblesFacet,
            EquityCompensationFacet equityCompensationFacet,
            StockPlanFacet stockPlanFacet,
            WarrantFacet warrantFacet,
            StakeholderNFTFacet stakeholderNFTFacet,
            AccessControlFacet accessControlFacet
        ) = deployFacets();

        // Create the cuts
        IDiamondCut.FacetCut[] memory cuts = createFacetCuts(
            diamondLoupeFacet,
            issuerFacet,
            stakeholderFacet,
            stockClassFacet,
            stockFacet,
            convertiblesFacet,
            equityCompensationFacet,
            stockPlanFacet,
            warrantFacet,
            stakeholderNFTFacet,
            accessControlFacet
        );

        // Execute diamond cut
        DiamondCutFacet(address(referenceDiamond)).diamondCut(cuts, address(0), "");

        // Create factory using reference diamond - owned by contractOwner
        factory = new CapTableFactory(referenceDiamond);

        // Create cap table - owned by contractOwner through factory
        address capTableAddr = factory.createCapTable(issuerId, issuerInitialSharesAuthorized);
        capTable = CapTable(payable(capTableAddr));

        vm.stopPrank();
    }

    function deployFacets()
        internal
        returns (
            DiamondLoupeFacet,
            IssuerFacet,
            StakeholderFacet,
            StockClassFacet,
            StockFacet,
            ConvertiblesFacet,
            EquityCompensationFacet,
            StockPlanFacet,
            WarrantFacet,
            StakeholderNFTFacet,
            AccessControlFacet
        )
    {
        return (
            new DiamondLoupeFacet(),
            new IssuerFacet(),
            new StakeholderFacet(),
            new StockClassFacet(),
            new StockFacet(),
            new ConvertiblesFacet(),
            new EquityCompensationFacet(),
            new StockPlanFacet(),
            new WarrantFacet(),
            new StakeholderNFTFacet(),
            new AccessControlFacet()
        );
    }

    function createFacetCuts(
        DiamondLoupeFacet diamondLoupeFacet,
        IssuerFacet issuerFacet,
        StakeholderFacet stakeholderFacet,
        StockClassFacet stockClassFacet,
        StockFacet stockFacet,
        ConvertiblesFacet convertiblesFacet,
        EquityCompensationFacet equityCompensationFacet,
        StockPlanFacet stockPlanFacet,
        WarrantFacet warrantFacet,
        StakeholderNFTFacet stakeholderNFTFacet,
        AccessControlFacet accessControlFacet
    )
        internal
        pure
        returns (IDiamondCut.FacetCut[] memory)
    {
        // Create cuts array for all facets
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](11);

        // Add DiamondLoupe functions
        bytes4[] memory loupeSelectors = new bytes4[](5);
        loupeSelectors[0] = DiamondLoupeFacet.facets.selector;
        loupeSelectors[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        loupeSelectors[2] = DiamondLoupeFacet.facetAddresses.selector;
        loupeSelectors[3] = DiamondLoupeFacet.facetAddress.selector;
        loupeSelectors[4] = DiamondLoupeFacet.supportsInterface.selector;

        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(diamondLoupeFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: loupeSelectors
        });

        // Add issuer functions
        bytes4[] memory issuerSelectors = new bytes4[](2);
        issuerSelectors[0] = IssuerFacet.initializeIssuer.selector;
        issuerSelectors[1] = IssuerFacet.adjustIssuerAuthorizedShares.selector;

        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(issuerFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: issuerSelectors
        });

        // Add stakeholder functions
        bytes4[] memory stakeholderSelectors = new bytes4[](3);
        stakeholderSelectors[0] = StakeholderFacet.createStakeholder.selector;
        stakeholderSelectors[1] = StakeholderFacet.getStakeholderPositions.selector;
        stakeholderSelectors[2] = StakeholderFacet.linkStakeholderAddress.selector;

        cuts[2] = IDiamondCut.FacetCut({
            facetAddress: address(stakeholderFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stakeholderSelectors
        });

        // Add stock class functions
        bytes4[] memory stockClassSelectors = new bytes4[](2);
        stockClassSelectors[0] = StockClassFacet.createStockClass.selector;
        stockClassSelectors[1] = StockClassFacet.adjustAuthorizedShares.selector;

        cuts[3] = IDiamondCut.FacetCut({
            facetAddress: address(stockClassFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockClassSelectors
        });

        // Add stock functions
        bytes4[] memory stockSelectors = new bytes4[](1);
        stockSelectors[0] = StockFacet.issueStock.selector;

        cuts[4] = IDiamondCut.FacetCut({
            facetAddress: address(stockFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockSelectors
        });

        // Add convertible functions
        bytes4[] memory convertibleSelectors = new bytes4[](2);
        convertibleSelectors[0] = ConvertiblesFacet.issueConvertible.selector;
        convertibleSelectors[1] = ConvertiblesFacet.getConvertiblePosition.selector;

        cuts[5] = IDiamondCut.FacetCut({
            facetAddress: address(convertiblesFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: convertibleSelectors
        });

        // Add equity compensation functions
        bytes4[] memory equityCompensationSelectors = new bytes4[](3);
        equityCompensationSelectors[0] = EquityCompensationFacet.issueEquityCompensation.selector;
        equityCompensationSelectors[1] = EquityCompensationFacet.getPosition.selector;
        equityCompensationSelectors[2] = EquityCompensationFacet.exerciseEquityCompensation.selector;

        cuts[6] = IDiamondCut.FacetCut({
            facetAddress: address(equityCompensationFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: equityCompensationSelectors
        });

        // Add stock plan functions
        bytes4[] memory stockPlanSelectors = new bytes4[](2);
        stockPlanSelectors[0] = StockPlanFacet.createStockPlan.selector;
        stockPlanSelectors[1] = StockPlanFacet.adjustStockPlanPool.selector;

        cuts[7] = IDiamondCut.FacetCut({
            facetAddress: address(stockPlanFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockPlanSelectors
        });

        // Add warrant functions
        bytes4[] memory warrantSelectors = new bytes4[](2);
        warrantSelectors[0] = WarrantFacet.issueWarrant.selector;
        warrantSelectors[1] = WarrantFacet.getWarrantPosition.selector;

        cuts[8] = IDiamondCut.FacetCut({
            facetAddress: address(warrantFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: warrantSelectors
        });

        // Add NFT functions
        bytes4[] memory nftSelectors = new bytes4[](2);
        nftSelectors[0] = StakeholderNFTFacet.mint.selector;
        nftSelectors[1] = StakeholderNFTFacet.tokenURI.selector;

        cuts[9] = IDiamondCut.FacetCut({
            facetAddress: address(stakeholderNFTFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: nftSelectors
        });

        // Add access control functions
        bytes4[] memory accessControlSelectors = new bytes4[](8);
        accessControlSelectors[0] = AccessControlFacet.grantRole.selector;
        accessControlSelectors[1] = AccessControlFacet.revokeRole.selector;
        accessControlSelectors[2] = AccessControlFacet.hasRole.selector;
        accessControlSelectors[3] = AccessControlFacet.initializeAccessControl.selector;
        accessControlSelectors[4] = AccessControlFacet.transferAdmin.selector;
        accessControlSelectors[5] = AccessControlFacet.acceptAdmin.selector;
        accessControlSelectors[6] = AccessControlFacet.getAdmin.selector;
        accessControlSelectors[7] = AccessControlFacet.getPendingAdmin.selector;

        cuts[10] = IDiamondCut.FacetCut({
            facetAddress: address(accessControlFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: accessControlSelectors
        });

        return cuts;
    }

    // Common helper functions
    function createStakeholder() public virtual returns (bytes16) {
        bytes16 stakeholderId = 0xd3373e0a4dd940000000000000000005;

        // Debug log before creation
        console.log("Before creation - index:", StorageLib.get().stakeholderIndex[stakeholderId]);

        vm.expectEmit(true, false, false, false, address(capTable));
        emit StakeholderCreated(stakeholderId);

        // Call through the diamond proxy instead of using delegatecall
        StakeholderFacet(address(capTable)).createStakeholder(stakeholderId);

        // Debug log after creation
        console.log("After creation - index:", StorageLib.get().stakeholderIndex[stakeholderId]);

        return stakeholderId;
    }

    // Helper function to create a stock class for testing
    function createStockClass() public virtual returns (bytes16) {
        bytes16 stockClassId = 0xd3373e0a4dd940000000000000000006;
        string memory classType = "COMMON";
        uint256 pricePerShare = 1e18;
        uint256 initialSharesAuthorized = 1_000_000;

        vm.expectEmit(true, true, true, true, address(capTable));
        emit StockClassCreated(stockClassId, classType, pricePerShare, initialSharesAuthorized);

        StockClassFacet(payable(address(capTable))).createStockClass(
            stockClassId, classType, pricePerShare, initialSharesAuthorized
        );

        return stockClassId;
    }

    // Helper function to create a stock plan for testing
    function createStockPlan(bytes16[] memory stockClassIds) public returns (bytes16) {
        bytes16 stockPlanId = 0xd3373e0a4dd940000000000000000007;
        uint256 sharesReserved = 100_000;

        vm.expectEmit(true, false, false, true, address(capTable));
        emit StockPlanCreated(stockPlanId, sharesReserved);

        StockPlanFacet(payable(address(capTable))).createStockPlan(stockPlanId, stockClassIds, sharesReserved);

        return stockPlanId;
    }

    // Add this helper function alongside the other helpers
    function linkStakeholderAddress(bytes16 _stakeholderId, address _wallet) public {
        StakeholderFacet(payable(address(capTable))).linkStakeholderAddress(_stakeholderId, _wallet);
    }
}
