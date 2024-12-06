// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { EquityCompensationActivePosition, EquityCompensationIssuanceParams } from "@libraries/Structs.sol";

contract DiamondEquityCompensationIssuanceTest is DiamondTestBase {
    bytes16 stakeholderId;
    bytes16 stockClassId;
    bytes16 stockPlanId;

    function setUp() public override {
        super.setUp();

        // Grant necessary roles
        vm.startPrank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, address(this));
        vm.stopPrank();

        stakeholderId = createStakeholder();
        stockClassId = createStockClass();

        // Create array properly
        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);
    }

    function testIssueEquityCompensation() public {
        bytes16 equityCompSecurityId = bytes16(0xd3373e0a4dd940000000000000000001);
        EquityCompensationIssuanceParams memory params = EquityCompensationIssuanceParams({
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: 1000,
            security_id: equityCompSecurityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_001",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(TxType.EQUITY_COMPENSATION_ISSUANCE, abi.encode(params));

        EquityCompensationFacet(address(capTable)).issueEquityCompensation(params);

        EquityCompensationActivePosition memory position =
            StorageLib.get().equityCompensationActivePositions.securities[equityCompSecurityId];
        assertEq(position.stakeholder_id, stakeholderId);
        assertEq(position.stock_class_id, stockClassId);
        assertEq(position.stock_plan_id, stockPlanId);
        assertEq(position.quantity, 1000);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = bytes16(0xd3373e0a4dd940000000000000000099);
        bytes16 equityCompSecurityId = bytes16(0xd3373e0a4dd940000000000000000001);

        EquityCompensationIssuanceParams memory params = EquityCompensationIssuanceParams({
            stakeholder_id: invalidStakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: 1000,
            security_id: equityCompSecurityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_001",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });

        EquityCompensationFacet(address(capTable)).issueEquityCompensation(params);
    }

    function testFailInvalidStockClass() public {
        bytes16 invalidStockClassId = bytes16(0xd3373e0a4dd940000000000000000099);
        bytes16 equityCompSecurityId = bytes16(0xd3373e0a4dd940000000000000000001);

        EquityCompensationIssuanceParams memory params = EquityCompensationIssuanceParams({
            stakeholder_id: stakeholderId,
            stock_class_id: invalidStockClassId,
            stock_plan_id: stockPlanId,
            quantity: 1000,
            security_id: equityCompSecurityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_001",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });

        EquityCompensationFacet(address(capTable)).issueEquityCompensation(params);
    }

    function testFailInvalidStockPlan() public {
        bytes16 invalidStockPlanId = bytes16(0xd3373e0a4dd940000000000000000099);
        bytes16 equityCompSecurityId = bytes16(0xd3373e0a4dd940000000000000000001);

        EquityCompensationIssuanceParams memory params = EquityCompensationIssuanceParams({
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: invalidStockPlanId,
            quantity: 1000,
            security_id: equityCompSecurityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_001",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });

        EquityCompensationFacet(address(capTable)).issueEquityCompensation(params);
    }

    function testFailZeroQuantity() public {
        bytes16 equityCompSecurityId = bytes16(0xd3373e0a4dd940000000000000000001);

        EquityCompensationIssuanceParams memory params = EquityCompensationIssuanceParams({
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: 0,
            security_id: equityCompSecurityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_001",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });

        EquityCompensationFacet(address(capTable)).issueEquityCompensation(params);
    }
}
