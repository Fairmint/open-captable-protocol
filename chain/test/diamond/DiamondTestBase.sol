// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@diamond/DiamondCapTable.sol";
import "@diamond/facets/IssuerFacet.sol";
import { StakeholderFacet } from "@diamond/facets/StakeholderFacet.sol";
import { StockClassFacet } from "@diamond/facets/StockClassFacet.sol";
import { StockFacet } from "@diamond/facets/StockFacet.sol";
import { ConvertiblesFacet } from "@diamond/facets/ConvertiblesFacet.sol";
import { EquityCompensationFacet } from "@diamond/facets/EquityCompensationFacet.sol";
import { StockPlanFacet } from "@diamond/facets/StockPlanFacet.sol";
import "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { WarrantFacet } from "@diamond/facets/WarrantFacet.sol";

contract DiamondTestBase is Test {
    uint256 public issuerInitialSharesAuthorized = 1000000;
    bytes16 public issuerId = 0xd3373e0a4dd9430f8a563281f2800e1e;
    address public contractOwner;

    DiamondCutFacet public diamondCutFacet;
    IssuerFacet public issuerFacet;
    StakeholderFacet public stakeholderFacet;
    StockClassFacet public stockClassFacet;
    StockFacet public stockFacet;
    ConvertiblesFacet public convertiblesFacet;
    EquityCompensationFacet public equityCompensationFacet;
    StockPlanFacet public stockPlanFacet;
    DiamondCapTable public diamond;
    WarrantFacet public warrantFacet;

    event StockIssued(bytes16 indexed stakeholderId, bytes16 indexed stockClassId, uint256 quantity, uint256 sharePrice);
    event StakeholderCreated(bytes16 indexed id);
    event StockClassCreated(bytes16 indexed id, string indexed classType, uint256 indexed pricePerShare, uint256 initialSharesAuthorized);
    event StockPlanCreated(bytes16 indexed id, uint256 shares_reserved);
    // TOOD: figure out if should use the facets' events?
    event IssuerAuthorizedSharesAdjusted(uint256 newSharesAuthorized);
    event StockClassAuthorizedSharesAdjusted(bytes16 indexed stockClassId, uint256 newSharesAuthorized);
    event StockPlanSharesReservedAdjusted(bytes16 indexed id, uint256 newSharesReserved);

    function setUp() public virtual {
        contractOwner = address(this);

        // Deploy facets
        diamondCutFacet = new DiamondCutFacet();
        issuerFacet = new IssuerFacet();
        stakeholderFacet = new StakeholderFacet();
        stockClassFacet = new StockClassFacet();
        stockFacet = new StockFacet();
        convertiblesFacet = new ConvertiblesFacet();
        equityCompensationFacet = new EquityCompensationFacet();
        stockPlanFacet = new StockPlanFacet();
        warrantFacet = new WarrantFacet();

        // Deploy Diamond
        diamond = new DiamondCapTable(contractOwner, address(diamondCutFacet));

        // Add facets
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](8);

        bytes4[] memory issuerSelectors = new bytes4[](2);
        issuerSelectors[0] = IssuerFacet.initializeIssuer.selector;
        issuerSelectors[1] = IssuerFacet.adjustAuthorizedShares.selector;

        bytes4[] memory stakeholderSelectors = new bytes4[](1);
        stakeholderSelectors[0] = StakeholderFacet.createStakeholder.selector;

        bytes4[] memory stockClassSelectors = new bytes4[](2);
        stockClassSelectors[0] = StockClassFacet.createStockClass.selector;
        stockClassSelectors[1] = StockClassFacet.adjustAuthorizedShares.selector;

        bytes4[] memory stockSelectors = new bytes4[](1);
        stockSelectors[0] = StockFacet.issueStock.selector;

        bytes4[] memory convertibleSelectors = new bytes4[](2);
        convertibleSelectors[0] = ConvertiblesFacet.issueConvertible.selector;
        convertibleSelectors[1] = ConvertiblesFacet.getConvertiblePosition.selector;

        bytes4[] memory equityCompensationSelectors = new bytes4[](2);
        equityCompensationSelectors[0] = EquityCompensationFacet.issueEquityCompensation.selector;
        equityCompensationSelectors[1] = EquityCompensationFacet.getPosition.selector;

        bytes4[] memory stockPlanSelectors = new bytes4[](2);
        stockPlanSelectors[0] = StockPlanFacet.createStockPlan.selector;
        stockPlanSelectors[1] = StockPlanFacet.adjustStockPlanPool.selector;

        bytes4[] memory warrantSelectors = new bytes4[](2);
        warrantSelectors[0] = WarrantFacet.issueWarrant.selector;
        warrantSelectors[1] = WarrantFacet.getWarrantPosition.selector;

        // issuer facet
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: address(issuerFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: issuerSelectors
        });

        // stakeholder facet
        cut[1] = IDiamondCut.FacetCut({
            facetAddress: address(stakeholderFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stakeholderSelectors
        });

        // stock class facet
        cut[2] = IDiamondCut.FacetCut({
            facetAddress: address(stockClassFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockClassSelectors
        });
        // stock facet
        cut[3] = IDiamondCut.FacetCut({
            facetAddress: address(stockFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockSelectors
        });

        // convertible facet
        cut[4] = IDiamondCut.FacetCut({
            facetAddress: address(convertiblesFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: convertibleSelectors
        });

        // equity facet
        cut[5] = IDiamondCut.FacetCut({
            facetAddress: address(equityCompensationFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: equityCompensationSelectors
        });

        // stock plan facet
        cut[6] = IDiamondCut.FacetCut({
            facetAddress: address(stockPlanFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockPlanSelectors
        });

        // warrant facet
        cut[7] = IDiamondCut.FacetCut({
            facetAddress: address(warrantFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: warrantSelectors
        });

        DiamondCutFacet(address(diamond)).diamondCut(cut, address(0), "");

        // Initialize issuer
        IssuerFacet(payable(address(diamond))).initializeIssuer(issuerId, issuerInitialSharesAuthorized);
    }

    // Common helper functions
    function createStakeholder() public returns (bytes16) {
        bytes16 stakeholderId = 0xd3373e0a4dd940000000000000000005;
        vm.expectEmit(true, false, false, false, address(diamond));
        emit StakeholderCreated(stakeholderId);
        StakeholderFacet(payable(address(diamond))).createStakeholder(stakeholderId);
        return stakeholderId;
    }

    // Helper function to create a stock class for testing
    function createStockClass() public returns (bytes16) {
        bytes16 stockClassId = 0xd3373e0a4dd940000000000000000006;
        string memory classType = "COMMON";
        uint256 pricePerShare = 1e18;
        uint256 initialSharesAuthorized = 1000000;

        vm.expectEmit(true, true, true, true, address(diamond));
        emit StockClassCreated(stockClassId, classType, pricePerShare, initialSharesAuthorized);

        StockClassFacet(payable(address(diamond))).createStockClass(stockClassId, classType, pricePerShare, initialSharesAuthorized);

        return stockClassId;
    }

    // Helper function to create a stock plan for testing
    function createStockPlan(bytes16[] memory stockClassIds) public returns (bytes16) {
        bytes16 stockPlanId = 0xd3373e0a4dd940000000000000000007;
        uint256 sharesReserved = 100000;

        vm.expectEmit(true, false, false, true, address(diamond));
        emit StockPlanCreated(stockPlanId, sharesReserved);

        StockPlanFacet(payable(address(diamond))).createStockPlan(stockPlanId, stockClassIds, sharesReserved);

        return stockPlanId;
    }
}
