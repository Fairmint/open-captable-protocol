// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "diamond-3-hardhat/libraries/LibDiamond.sol";
import { Diamond } from "diamond-3-hardhat/Diamond.sol";

contract CapTable is Diamond {
    constructor(address _owner, address _diamondCutFacet) Diamond(_owner, _diamondCutFacet) { }

    function transferOwner(address newOwner) public {
        LibDiamond.enforceIsContractOwner();
        // Only called by the owner
        LibDiamond.setContractOwner(newOwner);
    }
}
