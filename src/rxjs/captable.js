const StockClassTypes = {
    COMMON: "COMMON",
    PREFERRED: "PREFERRED",
};

const StockIssuanceTypes = {
    FOUNDERS_STOCK: "FOUNDERS_STOCK",
};

export const processCaptableStockIssuance = (state, transaction, _stakeholder, originalStockClass) => {
    const { stock_class_id, quantity, share_price } = transaction;
    const numShares = parseInt(quantity);

    // Early return if stock class not found
    if (!originalStockClass) {
        return {
            ...state,
            errors: [...state.errors, `Stock class not found: ${stock_class_id}`]
        };
    }

    // Get class type from original stock class
    const classType = originalStockClass.class_type;

    // Determine if this is a founder's preferred stock issuance
    const isFounderPreferred = classType === StockClassTypes.PREFERRED &&
        transaction.issuance_type === StockIssuanceTypes.FOUNDERS_STOCK;

    // Calculate voting power and liquidation
    const votingPower = originalStockClass.votes_per_share * numShares;
    const liquidation = numShares * Number(share_price?.amount || 0);

    // Update appropriate summary section
    let newSummary = { ...state.summary };

    if (isFounderPreferred) {
        // Update or create founder preferred summary
        newSummary.founderPreferred = newSummary.founderPreferred || {
            outstandingShares: 0,
            sharesAuthorized: originalStockClass.initial_shares_authorized,
            fullyDilutedShares: 0,
            liquidation: 0,
            votingPower: 0
        };

        newSummary.founderPreferred = {
            ...newSummary.founderPreferred,
            outstandingShares: newSummary.founderPreferred.outstandingShares + numShares,
            fullyDilutedShares: newSummary.founderPreferred.fullyDilutedShares + numShares,
            liquidation: newSummary.founderPreferred.liquidation + liquidation,
            votingPower: newSummary.founderPreferred.votingPower + votingPower
        };
    } else {
        const summarySection = classType === StockClassTypes.COMMON ? newSummary.common : newSummary.preferred;

        // Find existing row for this stock class
        const existingRowIndex = summarySection.rows.findIndex(row => row.name === originalStockClass.name);

        if (existingRowIndex >= 0) {
            // Update existing row
            const existingRow = summarySection.rows[existingRowIndex];
            summarySection.rows[existingRowIndex] = {
                ...existingRow,
                outstandingShares: existingRow.outstandingShares + numShares,
                fullyDilutedShares: existingRow.fullyDilutedShares + numShares,
                liquidation: existingRow.liquidation + liquidation,
                votingPower: existingRow.votingPower + votingPower
            };
        } else {
            // Create new row
            summarySection.rows.push({
                name: originalStockClass.name,
                sharesAuthorized: originalStockClass.initial_shares_authorized,
                outstandingShares: numShares,
                fullyDilutedShares: numShares,
                liquidation: liquidation,
                votingPower: votingPower
            });
        }
    }

    // Update totals
    newSummary.totals = {
        ...newSummary.totals,
        totalOutstandingShares: newSummary.totals.totalOutstandingShares + numShares,
        totalFullyDilutedShares: newSummary.totals.totalFullyDilutedShares + numShares,
        totalVotingPower: newSummary.totals.totalVotingPower + votingPower,
        totalLiquidation: (newSummary.totals.totalLiquidation || 0) + liquidation
    };

    return {
        ...state,
        summary: newSummary,
        isCapTableEmpty: false
    };
};

export const captableInitialState = (issuer, stockClasses, stockPlans, _stakeholders) => {
    // Calculate initial authorized shares for common and preferred
    const { commonAuthorized, preferredAuthorized } = stockClasses.reduce((acc, sc) => {
        const authorized = parseInt(sc.initial_shares_authorized || 0);
        if (sc.class_type === StockClassTypes.COMMON) {
            acc.commonAuthorized += authorized;
        } else if (sc.class_type === StockClassTypes.PREFERRED) {
            acc.preferredAuthorized += authorized;
        }
        return acc;
    }, { commonAuthorized: 0, preferredAuthorized: 0 });

    // Calculate total stock plan shares
    const totalStockPlanShares = stockPlans.reduce((sum, plan) => 
        sum + parseInt(plan.initial_shares_reserved || 0), 0);

    return {
        summary: {
            common: {
                totalSharesAuthorized: commonAuthorized,
                rows: []
            },
            preferred: {
                totalSharesAuthorized: preferredAuthorized,
                rows: []
            },
            founderPreferred: null,
            warrantsAndNonPlanAwards: {
                rows: []
            },
            stockPlans: {
                totalSharesAuthorized: totalStockPlanShares,
                rows: []
            },
            totals: {
                totalAuthorizedShares: parseInt(issuer.initial_shares_authorized || 0),
                totalOutstandingShares: 0,
                totalFullyDilutedShares: 0,
                totalFullyPercentage: 0,
                totalVotingPower: 0,
                totalVotingPowerPercentage: 0,
                totalLiquidation: 0
            }
        },
        convertibles: {
            isEmpty: true,
            convertiblesSummary: {},
            totals: {
                outstandingAmount: 0
            }
        },
        isCapTableEmpty: true
    };
};

export const processCaptableEquityCompensationIssuance = (state, transaction, originalStockClass) => {
    const { stock_plan_id, quantity, compensation_type } = transaction;
    const numShares = parseInt(quantity);

    // Early return if stock class not found
    if (!originalStockClass) {
        return {
            ...state,
            errors: [...state.errors, `Stock class not found for equity compensation issuance`]
        };
    }

    // Get stock plan name
    const stockPlan = state.stockPlans[stock_plan_id];
    if (!stockPlan) {
        return {
            ...state,
            errors: [...state.errors, `Stock plan not found: ${stock_plan_id}`]
        };
    }

    let newSummary = { ...state.summary };
    const stockPlanSummary = newSummary.stockPlans;

    // Create row name (e.g., "2022 STOCK OPTION/STOCK ISSUANCE PLAN Options")
    const rowName = `${stockPlan.name} ${compensation_type?.charAt(0).toUpperCase() + compensation_type?.slice(1).toLowerCase() || 'Awards'}`;

    // Find or create row for this plan/type combination
    const existingRowIndex = stockPlanSummary.rows.findIndex(row => row.name === rowName);

    if (existingRowIndex >= 0) {
        // Update existing row
        stockPlanSummary.rows[existingRowIndex] = {
            ...stockPlanSummary.rows[existingRowIndex],
            fullyDilutedShares: stockPlanSummary.rows[existingRowIndex].fullyDilutedShares + numShares
        };
    } else {
        // Create new row
        stockPlanSummary.rows.push({
            name: rowName,
            fullyDilutedShares: numShares
        });
    }

    // Calculate total issued shares for this plan
    const totalIssuedShares = stockPlanSummary.rows
        .filter(row => row.name !== 'Available for Grants')
        .reduce((sum, row) => sum + row.fullyDilutedShares, 0);

    // Calculate available shares
    const availableForGrants = stockPlan.sharesReserved - totalIssuedShares;

    // Update or create "Available for Grants" row
    const availableRowIndex = stockPlanSummary.rows.findIndex(row => row.name === 'Available for Grants');
    if (availableRowIndex >= 0) {
        stockPlanSummary.rows[availableRowIndex].fullyDilutedShares = availableForGrants;
    } else if (availableForGrants > 0) {
        stockPlanSummary.rows.push({
            name: 'Available for Grants',
            fullyDilutedShares: availableForGrants
        });
    }

    // Update totals
    newSummary.totals = {
        ...newSummary.totals,
        totalFullyDilutedShares: newSummary.totals.totalFullyDilutedShares + numShares
    };

    return {
        ...state,
        summary: newSummary,
        isCapTableEmpty: false
    };
}; 