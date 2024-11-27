// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";

// Run this script: forge script VerifyFacetUpdate --sig "run(address)" <factory_address> <facet_address>
contract VerifyFacetUpdateScript is Script {
    function run(address factoryAddress) external view {
        // Validate addresses
        require(factoryAddress != address(0), "Factory address cannot be zero address");
        require(factoryAddress.code.length > 0, "Factory address is not a contract");

        IDiamondLoupe diamond = IDiamondLoupe(factoryAddress);

        // Get all facets
        IDiamondLoupe.Facet[] memory facets = diamond.facets();

        console.log("Total number of facets:", facets.length);
        for (uint i = 0; i < facets.length; i++) {
            console.log("Facet", i, "address:", facets[i].facetAddress);
            console.log("Number of functions:", facets[i].functionSelectors.length);
        }

        require(facets.length > 0, "No facets found in diamond!");
        console.log("Verification successful!");
    }
}
