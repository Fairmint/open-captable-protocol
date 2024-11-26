import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
export const convertAndAdjustIssuerAuthorizedSharesOnChain = async (
    contract,
    { new_shares_authorized, board_approval_date = "", stockholder_approval_date = "", comments = [] }
) => {
    const scaledSharesAuthorized = toScaledBigNumber(new_shares_authorized);
    const tx = await contract.adjustIssuerAuthorizedShares(scaledSharesAuthorized, comments, board_approval_date, stockholder_approval_date);
    await tx.wait();
};
