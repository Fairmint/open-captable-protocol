// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Diamond } from "diamond-3-hardhat/Diamond.sol";
import { DiamondCutFacet } from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import { StockFacet } from "./facets/StockFacet.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { LibDiamond } from "diamond-3-hardhat/libraries/LibDiamond.sol";
// import { DiamondCapTable } from "./DiamondCapTable.sol";
import { DiamondCapTableNFT as DiamondCapTable } from "./DiamondCapTableNFT.sol";

// Create initialization contract

contract DiamondInit {
    function init(bytes16 id, uint256 initial_shares_authorized) external {
        // Get diamond storage
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // Set the contract owner
        ds.contractOwner = msg.sender;

        // Initialize the issuer through StockFacet
        DiamondCapTable(payable(address(this))).initializeIssuer(id, initial_shares_authorized);
    }
}

contract DiamondCapTableFactory {
    event CapTableCreated(address indexed capTable, bytes16 indexed issuerId);

    address[] public capTables;

    function createCapTable(bytes16 id, uint256 initial_shares_authorized) external returns (address) {
        require(id != bytes16(0) && initial_shares_authorized != 0, "Invalid issuer params");

        // Deploy facets
        DiamondCutFacet diamondCutFacet = new DiamondCutFacet();
        StockFacet stockFacet = new StockFacet();
        DiamondInit diamondInit = new DiamondInit();

        // Create FacetCut array
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](2);

        // DiamondCutFacet
        bytes4[] memory diamondCutSelectors = new bytes4[](1);
        diamondCutSelectors[0] = DiamondCutFacet.diamondCut.selector;
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(diamondCutFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: diamondCutSelectors
        });

        // StockFacet
        bytes4[] memory stockSelectors = new bytes4[](1);
        stockSelectors[0] = StockFacet.issueStock.selector;
        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(stockFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockSelectors
        });

        // Deploy Diamond
        Diamond diamond = new Diamond(msg.sender, address(diamondCutFacet));

        // Create initialization calldata
        bytes memory initCalldata = abi.encodeWithSelector(DiamondInit.init.selector, id, initial_shares_authorized);

        // Perform the cuts and initialize
        IDiamondCut(address(diamond)).diamondCut(cuts, address(diamondInit), initCalldata);

        // Store the new cap table
        capTables.push(address(diamond));

        emit CapTableCreated(address(diamond), id);
        return address(diamond);
    }

    function getCapTableCount() external view returns (uint256) {
        return capTables.length;
    }
}