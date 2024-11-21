// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DiamondTestBase.sol";
import { StorageLib } from "@diamond/Storage.sol";
import { TxHelper, TxType } from "@diamond/DiamondTxHelper.sol";
import { ValidationLib } from "@diamond/libraries/ValidationLib.sol";
import { ConvertibleActivePosition } from "@diamond/Structs.sol";

contract DiamondConvertibleIssuanceTest is DiamondTestBase {
    function testIssueConvertible() public {
        bytes16 stakeholderId = createStakeholder();
        uint256 investmentAmount = 1000000;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        vm.expectEmit(true, true, false, true, address(diamond));
        emit TxHelper.TxCreated(TxType.CONVERTIBLE_ISSUANCE, abi.encode(stakeholderId, investmentAmount, securityId));

        ConvertiblesFacet(address(diamond)).issueConvertible(stakeholderId, investmentAmount, securityId);

        // Verify position was created correctly
        ConvertibleActivePosition memory position = ConvertiblesFacet(address(diamond)).getConvertiblePosition(securityId);
        assertEq(position.investment_amount, investmentAmount);
        assertEq(position.stakeholder_id, stakeholderId);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        ConvertiblesFacet(address(diamond)).issueConvertible(invalidStakeholderId, 1000000, securityId);
    }

    function testFailZeroAmount() public {
        bytes16 stakeholderId = createStakeholder();
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        ConvertiblesFacet(address(diamond)).issueConvertible(stakeholderId, 0, securityId);
    }
}