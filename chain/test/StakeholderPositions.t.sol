// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import {
    StockIssuanceParams,
    WarrantActivePosition,
    ConvertibleActivePosition,
    EquityCompensationActivePosition,
    StakeholderPositions,
    ConvertibleIssuanceParams,
    EquityCompensationIssuanceParams
} from "@libraries/Structs.sol";

contract DiamondStakeholderPositionsTest is DiamondTestBase {
    bytes16 stakeholderId;
    bytes16 stockClassId;
    bytes16 stockPlanId;
    bytes16 equityCompSecurityId;
    bytes16 stockSecurityId;
    bytes16 convertibleSecurityId;

    function setUp() public override {
        super.setUp();
        stakeholderId = createStakeholder();
        stockClassId = createStockClass();

        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);

        // Issue stock to stakeholder
        bytes16 securityId = bytes16(keccak256("security1"));
        StockIssuanceParams memory params = StockIssuanceParams({
            stock_class_id: stockClassId,
            share_price: 10_000_000_000,
            quantity: 1000,
            stakeholder_id: stakeholderId,
            security_id: securityId,
            custom_id: "STOCK_001",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        StockFacet(address(capTable)).issueStock(params);

        // Issue convertible
        convertibleSecurityId = 0xd3373e0a4dd940000000000000000002;
        ConvertibleIssuanceParams memory convertibleParams = ConvertibleIssuanceParams({
            stakeholder_id: stakeholderId,
            investment_amount: 1e18,
            security_id: convertibleSecurityId,
            convertible_type: "SAFE",
            seniority: 1,
            custom_id: "CONV_POS_001",
            security_law_exemptions_mapping: "REG_D",
            conversion_triggers_mapping: "TRIGGER_1"
        });
        ConvertiblesFacet(address(capTable)).issueConvertible(convertibleParams);

        // Issue equity compensation
        equityCompSecurityId = 0xd3373e0a4dd940000000000000000003;
        EquityCompensationIssuanceParams memory eqCompParams = EquityCompensationIssuanceParams({
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
        EquityCompensationFacet(address(capTable)).issueEquityCompensation(eqCompParams);
    }

    function testGetStakeholderPositions() public {
        StakeholderPositions memory positions =
            StakeholderFacet(address(capTable)).getStakeholderPositions(stakeholderId);

        // Verify stock position
        assertEq(positions.stocks.length, 1);
        assertEq(positions.stocks[0].stakeholder_id, stakeholderId);
        assertEq(positions.stocks[0].stock_class_id, stockClassId);
        assertEq(positions.stocks[0].quantity, 1000);
        assertEq(positions.stocks[0].share_price, 10_000_000_000);

        // Verify convertible position
        assertEq(positions.convertibles.length, 1);
        assertEq(positions.convertibles[0].stakeholder_id, stakeholderId);
        assertEq(positions.convertibles[0].investment_amount, 1_000_000_000_000_000_000);

        // Verify equity compensation position
        assertEq(positions.equityCompensations.length, 1);
        assertEq(positions.equityCompensations[0].stakeholder_id, stakeholderId);
        assertEq(positions.equityCompensations[0].quantity, 1000);
        assertEq(positions.equityCompensations[0].stock_class_id, stockClassId);
        assertEq(positions.equityCompensations[0].stock_plan_id, stockPlanId);
    }
}
