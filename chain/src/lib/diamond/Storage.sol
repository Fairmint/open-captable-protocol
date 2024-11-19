// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ActivePosition, Issuer, StockClass, Stakeholder } from "../Structs.sol";
struct Storage {
    mapping(bytes16 => mapping(bytes16 => ActivePosition)) activePositions;
    mapping(bytes16 => mapping(bytes16 => bytes16[])) activeSecurityIdsByStockClass;
    bytes[] transactions;
    Issuer issuer;
    Stakeholder[] stakeholders;
    StockClass[] stockClasses;
    mapping(bytes16 => uint256) stakeholderIndex;
    mapping(bytes16 => uint256) stockClassIndex;
}

library StorageLib {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.storage.stock");

    /// @notice Get the diamond storage
    /// @return ds The diamond storage
    function get() internal pure returns (Storage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}