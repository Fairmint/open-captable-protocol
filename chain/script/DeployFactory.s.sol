// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import { CapTableFactory } from "@core/CapTableFactory.sol";
import { CapTable } from "@core/CapTable.sol";
import { DiamondCutFacet } from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import { IssuerFacet } from "@facets/IssuerFacet.sol";
import { DiamondLoupeFacet } from "diamond-3-hardhat/facets/DiamondLoupeFacet.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { StakeholderFacet } from "@facets/StakeholderFacet.sol";
import { StockClassFacet } from "@facets/StockClassFacet.sol";
import { StockFacet } from "@facets/StockFacet.sol";
import { ConvertiblesFacet } from "@facets/ConvertiblesFacet.sol";
import { EquityCompensationFacet } from "@facets/EquityCompensationFacet.sol";
import { StockPlanFacet } from "@facets/StockPlanFacet.sol";
import { WarrantFacet } from "@facets/WarrantFacet.sol";
import { StakeholderNFTFacet } from "@facets/StakeholderNFTFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { AccessControlFacet } from "@facets/AccessControlFacet.sol";

contract DeployFactoryScript is Script {
    struct FacetData {
        address facetAddress;
        bytes4[] selectors;
    }

    function createFacets()
        internal
        returns (
            DiamondCutFacet,
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
            new DiamondCutFacet(),
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

    function deployInitialFacets(address _contractOwner) internal returns (address) {
        // Deploy all facets
        console.log("Deploying facets...");
        console.log("msg.sender: ", msg.sender);
        console.log("_contractOwner: ", _contractOwner);

        // Deploy facets
        (
            DiamondCutFacet diamondCutFacet,
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
        ) = createFacets();

        // Create reference diamond with deployer as owner
        CapTable referenceDiamond = new CapTable(_contractOwner, address(diamondCutFacet));
        console.log("Reference diamond created at:", address(referenceDiamond));

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

        return address(referenceDiamond);
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        if (deployerPrivateKey == 0) {
            revert("Missing PRIVATE_KEY in .env");
        }
        vm.startBroadcast(deployerPrivateKey);

        // Try to get addresses from env
        address referenceDiamond = vm.envOr("REFERENCE_DIAMOND", address(0));
        address deployerWallet = vm.addr(deployerPrivateKey);

        // Deploy new facets if addresses not in env
        if (referenceDiamond == address(0)) {
            referenceDiamond = deployInitialFacets(deployerWallet);
        }

        console.log("------- New Facet Addresses (Add to .env) -------");
        console.log("REFERENCE_DIAMOND=", referenceDiamond);
        console.log("-------------------------------------------------");

        // Deploy factory with facet addresses
        CapTableFactory factory = new CapTableFactory(referenceDiamond);

        address capTable = factory.createCapTable(bytes16("TEST"), 1_000_000);
        console.log("\nCapTableFactory deployed at:", address(factory));
        console.log("CapTable deployed at:", capTable);
        vm.stopPrank();
        console.log("Diamond admin after accepting:", AccessControlFacet(capTable).getAdmin());
        // Verify factory is no longer admin
        console.log(
            "Factory is admin:",
            AccessControlFacet(capTable).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, address(factory))
        );

        vm.stopBroadcast();
    }

    function runProduction() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        if (deployerPrivateKey == 0) {
            revert("Missing PRIVATE_KEY in .env");
        }
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deploying DiamondCapTable system to Base Sepolia");

        vm.startBroadcast(deployerPrivateKey);

        // Try to get addresses from env
        address referenceDiamond = vm.envOr("REFERENCE_DIAMOND", address(0));

        // Deploy new facets if addresses not in env
        if (referenceDiamond == address(0)) {
            revert("Missing REFERENCE_DIAMOND in .env");
        }
        // Deploy factory with facet addresses
        CapTableFactory factory = new CapTableFactory(referenceDiamond);

        console.log("\nCapTableFactory deployed at:", address(factory));

        vm.stopPrank();
        // console.log("Diamond admin after accepting:", AccessControlFacet(diamond).getAdmin());
        // Verify factory is no longer admin
        // console.log(
        //     "Factory is admin:", AccessControlFacet(diamond).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, address(factory))
        // );
        vm.stopPrank();
        vm.stopBroadcast();
    }
}
