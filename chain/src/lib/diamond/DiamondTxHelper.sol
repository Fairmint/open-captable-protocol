// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { StockIssuance, StockIssuanceParams, ActivePositions, ActivePosition, SecIdsStockClass, Issuer, StockClass, StockTransfer, StockRepurchase, ShareNumbersIssued, StockAcceptance, StockCancellation, StockReissuance, StockRetraction, IssuerAuthorizedSharesAdjustment, StockClassAuthorizedSharesAdjustment, StockTransferParams, StockParamsQuantity, StockIssuanceParams, SecurityLawExemption } from "../Structs.sol";

enum TxType {
    INVALID,
    ISSUER_AUTHORIZED_SHARES_ADJUSTMENT,
    STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT,
    STOCK_ACCEPTANCE,
    STOCK_CANCELLATION,
    STOCK_ISSUANCE,
    STOCK_REISSUANCE,
    STOCK_REPURCHASE,
    STOCK_RETRACTION,
    STOCK_TRANSFER,
    CONVERTIBLE_ISSUANCE,
    EQUITY_COMPENSATION_ISSUANCE
}

struct Tx {
    TxType txType;
    bytes txData;
}

library TxHelper {
    event TxCreated(TxType txType, bytes txData);

    function createTx(TxType txType, bytes memory txData) internal {
        emit TxCreated(txType, txData);
    }

    function generateDeterministicUniqueID(bytes16 stakeholderId, uint256 nonce) public view returns (bytes16) {
        bytes16 deterministicValue = bytes16(keccak256(abi.encodePacked(stakeholderId, block.timestamp, block.prevrandao, nonce)));
        return deterministicValue;
    }
}
