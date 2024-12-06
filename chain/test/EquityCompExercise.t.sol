// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import {
    EquityCompensationActivePosition,
    StockActivePosition,
    StockIssuanceParams,
    EquityCompensationIssuanceParams
} from "@libraries/Structs.sol";

contract DiamondEquityCompExerciseTest is DiamondTestBase {
    bytes16 stakeholderId;
    bytes16 stockClassId;
    bytes16 stockPlanId;
    bytes16 equityCompSecurityId;
    bytes16 stockSecurityId;
    uint256 constant EQUITY_COMP_QUANTITY = 1000;
    address stakeholderWallet;

    function setUp() public override {
        super.setUp();

        // Grant necessary roles
        vm.startPrank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, address(this));
        vm.stopPrank();

        // Create prerequisites
        stakeholderId = createStakeholder();
        stakeholderWallet = address(0xF62849F9A0B5Bf2913b396098F7c7019b51A820a);
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Grant investor role to stakeholder
        vm.prank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.INVESTOR_ROLE, stakeholderWallet);

        stockClassId = createStockClass();

        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);

        // Issue equity compensation
        equityCompSecurityId = 0xd3373e0a4dd940000000000000000001;
        EquityCompensationIssuanceParams memory eqCompParams = EquityCompensationIssuanceParams({
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: EQUITY_COMP_QUANTITY,
            security_id: equityCompSecurityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_EX_001",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });
        EquityCompensationFacet(address(capTable)).issueEquityCompensation(eqCompParams);

        // Issue resulting stock
        bytes16 securityId1 = bytes16(keccak256("security1"));
        StockIssuanceParams memory params = StockIssuanceParams({
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: EQUITY_COMP_QUANTITY,
            stakeholder_id: stakeholderId,
            security_id: securityId1,
            custom_id: "STOCK_EX_001",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        StockFacet(address(capTable)).issueStock(params);
        stockSecurityId = securityId1;
    }

    function testExerciseEquityCompensation() public {
        uint256 exerciseQuantity = 500;

        // Issue new stock position with exact quantity to exercise
        bytes16 securityId2 = bytes16(keccak256("security2"));
        StockIssuanceParams memory params2 = StockIssuanceParams({
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: exerciseQuantity,
            stakeholder_id: stakeholderId,
            security_id: securityId2,
            custom_id: "STOCK_EX_002",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        StockFacet(address(capTable)).issueStock(params2);

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.EQUITY_COMPENSATION_EXERCISE, abi.encode(equityCompSecurityId, securityId2, exerciseQuantity)
        );

        // Exercise as stakeholder
        vm.prank(stakeholderWallet);
        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            equityCompSecurityId, securityId2, exerciseQuantity
        );

        // Verify equity comp position was updated
        EquityCompensationActivePosition memory position =
            EquityCompensationFacet(address(capTable)).getPosition(equityCompSecurityId);
        assertEq(position.quantity, EQUITY_COMP_QUANTITY - exerciseQuantity);
    }

    function testExerciseEquityCompensationFull() public {
        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.EQUITY_COMPENSATION_EXERCISE, abi.encode(equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY)
        );

        // Exercise as stakeholder
        vm.prank(stakeholderWallet);
        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY
        );

        // Verify position was removed
        EquityCompensationActivePosition memory position =
            EquityCompensationFacet(address(capTable)).getPosition(equityCompSecurityId);
        assertEq(position.quantity, 0);
    }

    function testFailInvalidEquityCompSecurity() public {
        bytes16 invalidSecurityId = 0xd3373e0a4dd940000000000000000099;

        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(invalidSecurityId, stockSecurityId, 500);
    }

    function testFailInvalidStockSecurity() public {
        bytes16 invalidStockId = 0xd3373e0a4dd940000000000000000099;

        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(equityCompSecurityId, invalidStockId, 500);
    }

    function testFailInsufficientShares() public {
        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY + 1
        );
    }

    function testFailWrongStakeholder() public {
        // Create a different stakeholder with unique ID
        bytes16 otherStakeholderId = createStakeholder();

        // Issue stock to different stakeholder
        bytes16 securityId3 = bytes16(keccak256("security3"));
        StockIssuanceParams memory params3 = StockIssuanceParams({
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: 500,
            stakeholder_id: otherStakeholderId,
            security_id: securityId3,
            custom_id: "STOCK_EX_003",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        StockFacet(address(capTable)).issueStock(params3);

        vm.expectRevert(
            abi.encodeWithSelector(ValidationLib.InvalidSecurityStakeholder.selector, securityId3, stakeholderId)
        );
        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(equityCompSecurityId, securityId3, 500);
    }
}
