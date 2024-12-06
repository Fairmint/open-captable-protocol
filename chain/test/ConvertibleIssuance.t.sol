// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ConvertibleIssuanceParams } from "@libraries/Structs.sol";

contract DiamondConvertibleIssuanceTest is DiamondTestBase {
    function testIssueConvertible() public {
        bytes16 stakeholderId = createStakeholder();
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        uint256 investmentAmount = 1_000_000;

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.CONVERTIBLE_ISSUANCE,
            abi.encode(
                stakeholderId,
                investmentAmount,
                securityId,
                "SAFE", // convertible_type
                "TRIGGER_1", // conversion_triggers_mapping
                uint256(1), // seniority
                "REG_D", // security_law_exemptions_mapping
                "CONV_001" // custom_id
            )
        );

        ConvertibleIssuanceParams memory params = ConvertibleIssuanceParams({
            stakeholder_id: stakeholderId,
            investment_amount: investmentAmount,
            security_id: securityId,
            convertible_type: "SAFE",
            seniority: 1,
            custom_id: "CONV_001",
            security_law_exemptions_mapping: "REG_D",
            conversion_triggers_mapping: "TRIGGER_1"
        });

        ConvertiblesFacet(address(capTable)).issueConvertible(params);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        ConvertibleIssuanceParams memory params = ConvertibleIssuanceParams({
            stakeholder_id: invalidStakeholderId,
            investment_amount: 1_000_000,
            security_id: securityId,
            convertible_type: "SAFE",
            seniority: 1,
            custom_id: "CONV_002",
            security_law_exemptions_mapping: "REG_D",
            conversion_triggers_mapping: "TRIGGER_1"
        });

        ConvertiblesFacet(address(capTable)).issueConvertible(params);
    }

    function testFailInvalidAmount() public {
        bytes16 stakeholderId = createStakeholder();
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        ConvertibleIssuanceParams memory params = ConvertibleIssuanceParams({
            stakeholder_id: stakeholderId,
            investment_amount: 0,
            security_id: securityId,
            convertible_type: "SAFE",
            seniority: 1,
            custom_id: "CONV_003",
            security_law_exemptions_mapping: "REG_D",
            conversion_triggers_mapping: "TRIGGER_1"
        });

        ConvertiblesFacet(address(capTable)).issueConvertible(params);
    }
}
