const StockClassTypes = {
    COMMON: "COMMON",
    PREFERRED: "PREFERRED",
};

const StockIssuanceTypes = {
    FOUNDERS_STOCK: "FOUNDERS_STOCK",
};

const processFounderPreferredStock = (state, summary, stockClassId, numShares, liquidation, votingPower) => {
    // Initialize if this is the first founder preferred issuance
    if (!summary.founderPreferred) {
        summary.founderPreferred = {
            outstandingShares: 0,
            sharesAuthorized: 0, // There's no shares authorized for founder preferred stock, we use outstanding shares
            fullyDilutedShares: 0,
            liquidation: 0,
            votingPower: 0
        };
    }

    // Add new shares to existing totals
    summary.founderPreferred.sharesAuthorized += numShares;
    summary.founderPreferred.outstandingShares += numShares;
    summary.founderPreferred.fullyDilutedShares += numShares;
    summary.founderPreferred.liquidation += liquidation;
    summary.founderPreferred.votingPower += votingPower;

    return summary;
};

export const processCaptableStockIssuance = (state, transaction, _stakeholder, originalStockClass) => {
    const { stock_class_id, quantity, issuance_type } = transaction;
    const numShares = parseInt(quantity);
    const classType = originalStockClass.class_type;

    let newSummary = { ...state.summary };

    // Calculate metrics for this issuance
    const votingPower = originalStockClass.votes_per_share * numShares;
    const liquidation = numShares * Number(originalStockClass.price_per_share.amount) * Number(originalStockClass.liquidation_preference_multiple);

    // Check if this is founder preferred stock
    if (classType === StockClassTypes.PREFERRED &&
        issuance_type === StockIssuanceTypes.FOUNDERS_STOCK) {

        newSummary = processFounderPreferredStock(
            state,
            newSummary,
            stock_class_id,
            numShares,
            liquidation,
            votingPower
        );

        return { summary: newSummary };
    }

    // Handle regular stock issuance
    const section = classType === StockClassTypes.COMMON ? newSummary.common : newSummary.preferred;
    const existingRowIndex = section.rows.findIndex(row => row.name === originalStockClass.name);

    if (existingRowIndex >= 0) {
        const existingRow = section.rows[existingRowIndex];
        section.rows[existingRowIndex] = {
            ...existingRow,
            outstandingShares: existingRow.outstandingShares + numShares,
            fullyDilutedShares: existingRow.fullyDilutedShares + numShares,
            liquidation: existingRow.liquidation + liquidation,
            votingPower: existingRow.votingPower + votingPower
        };
    } else {
        section.rows.push({
            name: originalStockClass.name,
            sharesAuthorized: state.stockClasses[stock_class_id].sharesAuthorized,
            outstandingShares: numShares,
            fullyDilutedShares: numShares,
            liquidation: liquidation,
            votingPower: votingPower
        });
    }

    return { summary: newSummary };
};

export const captableInitialState = (_stakeholders) => {
    // Initialize sections with empty rows
    return {
        summary: {
            common: {
                rows: []
            },
            preferred: {
                rows: []
            },
            founderPreferred: null,
            warrantsAndNonPlanAwards: {
                rows: []
            },
            stockPlans: {
                rows: []
            },
            totals: {} // Empty totals object - will be calculated in index.js
        },
        convertibles: {
            isEmpty: true,
            convertiblesSummary: {},
            totals: {}
        },
        isCapTableEmpty: true
    };
};

export const processCaptableStockClassAdjustment = (state, transaction, originalStockClass) => {
    const { stock_class_id } = transaction;
    let newSummary = { ...state.summary };

    // Just update the sharesAuthorized in the appropriate row
    const section = originalStockClass.class_type === StockClassTypes.COMMON ?
        newSummary.common : newSummary.preferred;

    const rowIndex = section.rows.findIndex(row => row.name === originalStockClass.name);
    if (rowIndex >= 0) {
        section.rows[rowIndex] = {
            ...section.rows[rowIndex],
            sharesAuthorized: state.stockClasses[stock_class_id].sharesAuthorized
        };
    }

    return { summary: newSummary };
};

export const processCaptableEquityCompensationIssuance = (state, transaction, stockPlan) => {
    const { stock_plan_id, quantity, compensation_type } = transaction;
    const numShares = parseInt(quantity);
    let newSummary = { ...state.summary };

    // Skip if no stock plan, it belongs inside of Warrans and Non Plan Awards
    if (!stock_plan_id || !stockPlan) {
        return { summary: newSummary };
    }

    // Format the row name: "Plan Name Options" or "Plan Name RSUs"
    const formattedCompType = compensation_type.charAt(0).toUpperCase() +
        compensation_type.slice(1).toLowerCase() + 's';
    const rowName = `${stockPlan.plan_name} ${formattedCompType}`;

    // Find existing row for this plan + compensation type combination
    const rowIndex = newSummary.stockPlans.rows.findIndex(
        row => row.name === rowName
    );

    if (rowIndex >= 0) {
        // Update existing row's shares
        newSummary.stockPlans.rows[rowIndex] = {
            ...newSummary.stockPlans.rows[rowIndex],
            fullyDilutedShares: newSummary.stockPlans.rows[rowIndex].fullyDilutedShares + numShares
        };
    } else {
        // Add new row for this plan + compensation type
        newSummary.stockPlans.rows.push({
            name: rowName,
            fullyDilutedShares: numShares
        });
    }

    return { summary: newSummary };
};

export const processCaptableWarrantAndNonPlanAwardIssuance = (state, transaction, stakeholder, originalStockClass) => {
    console.log('original stock class', originalStockClass);
    const { quantity, object_type, compensation_type, exercise_triggers } = transaction;
    let newSummary = { ...state.summary };

    // Calculate shares based on transaction type
    let numShares;
    if (object_type === 'TX_WARRANT_ISSUANCE') {
        // For warrants, use the conversion quantity from exercise triggers
        numShares = parseInt(exercise_triggers?.[0]?.conversion_right?.conversion_mechanism?.converts_to_quantity || 0);
    } else {
        // For non-plan equity compensation, use quantity directly
        numShares = parseInt(quantity);
    }

    // Format row name based on transaction type
    let rowName;
    if (object_type === 'TX_WARRANT_ISSUANCE') {
        rowName = `${originalStockClass.name} Warrants`;
    } else {
        const formattedCompType = compensation_type.charAt(0).toUpperCase() +
            compensation_type.slice(1).toLowerCase() + 's';
        rowName = `${originalStockClass.name} ${formattedCompType}`;
    }

    // Find existing row or create new one
    const rowIndex = newSummary.warrantsAndNonPlanAwards.rows.findIndex(
        row => row.name === rowName
    );

    if (rowIndex >= 0) {
        // Update existing row
        newSummary.warrantsAndNonPlanAwards.rows[rowIndex] = {
            ...newSummary.warrantsAndNonPlanAwards.rows[rowIndex],
            fullyDilutedShares: newSummary.warrantsAndNonPlanAwards.rows[rowIndex].fullyDilutedShares + numShares
        };
    } else {
        // Add new row
        newSummary.warrantsAndNonPlanAwards.rows.push({
            name: rowName,
            fullyDilutedShares: numShares
        });
    }

    return { summary: newSummary };
};