import { find } from "../../db/operations/atomic.js";
import get from "lodash/get";
import Stockclass from "../../db/objects/StockClass.js";
import StockPlan from "../../db/objects/StockPlan.js";
import Stakeholder from "../../db/objects/Stakeholder.js";
import Convertible from "../../db/objects/transactions/issuance/ConvertibleIssuance.js";
import { getStockIssuances } from "./helpers.js";
import WarrantIssuance from "../../db/objects/transactions/issuance/WarrantIssuance.js";
import EquityCompensationIssuance from "../../db/objects/transactions/issuance/EquityCompensationIssuance.js";

const StockClassTypes = {
    COMMON: "COMMON",
    PREFERRED: "PREFERRED",
};

const StockIssuanceTypes = {
    FOUNDERS_STOCK: "FOUNDERS_STOCK",
};


const getAllEquityCompensationIssuances = async (issuerId) => {
    return (await find(EquityCompensationIssuance, { issuer: issuerId })) || [];
};

const getAllWarrants = async (issuerId) => {
    return (await find(WarrantIssuance, { issuer: issuerId })) || [];
};

const getAllStockClasses = async (issuerId) => {
    return (await find(Stockclass, { issuer: issuerId })) || [];
};

const getAllStockPlans = async (issuerId) => {
    return (await find(StockPlan, { issuer: issuerId })) || [];
};

const getAllConvertibles = async (issuerId) => {
    return (await find(Convertible, { issuer: issuerId })) || [];
};

const getAllStakeholders = async (issuerId) => {
    return (await find(Stakeholder, { issuer: issuerId })) || [];
};



const calculateTotalVotingPower = (stockClasses, outstandingSharesByStockClass) => {
    return stockClasses.reduce((acc, stockClass) => {
        const outstandingShares = outstandingSharesByStockClass[stockClass._id] || 0;
        return acc + Number(stockClass.votes_per_share) * outstandingShares;
    }, 0);
};

/*
    Note: we exclude the founder preferred stock issuances from the preferred stock classes summary.
*/
const calculateStockClassSummary = (stockClasses, stockIssuances, excludeIssuanceType = null) => {
    const totalSharesAuthorized = stockClasses.reduce((sum, sc) => sum + Number(sc.initial_shares_authorized), 0);

    const rows = stockClasses.map(stockClass => {
        const classIssuances = stockIssuances.filter(issuance =>
            issuance.stock_class_id === stockClass._id &&
            (excludeIssuanceType ? issuance.issuance_type !== excludeIssuanceType : true)
        );

        if (classIssuances.length === 0) return null;

        const outstandingShares = classIssuances.reduce((sum, issuance) => sum + Number(issuance.quantity), 0);
        const votingPower = stockClass.votes_per_share * outstandingShares;

        return {
            name: stockClass.name,
            sharesAuthorized: stockClass.initial_shares_authorized,
            outstandingShares,
            fullyDilutedShares: outstandingShares,
            liquidationPreference: stockClass.liquidation_preference_multiple,
            votingPower
        };
    }).filter(row => row !== null);

    return {
        totalSharesAuthorized,
        rows
    };
};

const calculateFounderPreferredSummary = (preferredStockClasses, stockIssuances) => {
    const founderIssuances = stockIssuances.filter(issuance => issuance.issuance_type === StockIssuanceTypes.FOUNDERS_STOCK);

    console.log('founderIssuances', founderIssuances);

    if (founderIssuances.length === 0) return null;

    const outstandingShares = founderIssuances.reduce((sum, issuance) => sum + Number(issuance.quantity), 0);

    const founderPreferredClasses = preferredStockClasses.filter(stockClass =>
        founderIssuances.some(issuance => issuance.stock_class_id === stockClass._id)
    );

    const votingPower = founderIssuances.reduce((sum, issuance) => {
        const stockClass = founderPreferredClasses.find(sc => sc._id === issuance.stock_class_id);
        return sum + (stockClass ? stockClass.votes_per_share * Number(issuance.quantity) : 0);
    }, 0);

    return {
        outstandingShares,
        sharesAuthorized: outstandingShares,
        fullyDilutedShares: outstandingShares,
        liquidationPreference: String(Math.max(...founderPreferredClasses.map(sc => Number(sc.liquidation_preference_multiple)))),
        votingPower
    };
};

// modularizing the row creation for warrants and non-plan awards
// for warrants, we need to use the exercise_triggers to get the quantity of shares that the warrant can convert to
// for non-plan awards, we can just use the quantity
const createWarrantAndNonPlanAwardsRow = (issuancesByStockClass, stockClasses, totalOutstandingShares, suffix, isWarrant = false) => {
    return Object.entries(issuancesByStockClass).map(([stockClassId, issuances]) => {
        const fullyDilutedShares = issuances.reduce((sum, issuance) => {
            let quantity;
            if (isWarrant) {
                quantity = Number(get(issuance, 'exercise_triggers[0].conversion_right.conversion_mechanism.converts_to_quantity', 0));
            } else {
                quantity = Number(issuance.quantity);
            }
            return sum + (isNaN(quantity) ? 0 : quantity);
        }, 0);

        let name;
        if (stockClassId === 'general') {
            name = `General ${suffix}`;
        } else {
            const stockClass = stockClasses.find(sc => sc._id === stockClassId);
            name = stockClass ? `${stockClass.name} ${suffix}` : `Unknown Stock Class ${suffix}`;
        }

        return {
            name,
            fullyDilutedShares,
        };
    });
}

const createEquityCompensationWithPlanAndTypeSummaryRows = (equityCompensationByStockPlanAndType, stockPlans) => {
    return Object.entries(equityCompensationByStockPlanAndType).flatMap(([stockPlanId, typeIssuances]) => {
        const stockPlan = stockPlans.find(sp => sp._id === stockPlanId);
        const stockPlanName = stockPlan ? stockPlan.plan_name : 'Unknown Stock Plan';

        return Object.entries(typeIssuances).map(([compensationType, issuances]) => {
            const fullyDilutedShares = issuances.reduce((sum, issuance) => {
                const quantity = Number(issuance.quantity);
                return sum + (isNaN(quantity) ? 0 : quantity);
            }, 0);

            return {
                name: `${stockPlanName} ${compensationType.charAt(0).toUpperCase() + compensationType.slice(1).toLowerCase()}s`,
                fullyDilutedShares,
            };
        });
    });
}

const groupIssuancesByStockClass = (issuances, stockClassIdPath) => {
    return issuances.reduce((acc, issuance) => {
        const stockClassId = get(issuance, stockClassIdPath) || 'general';
        if (!acc[stockClassId]) {
            acc[stockClassId] = [];
        }
        acc[stockClassId].push(issuance);
        return acc;
    }, {});
}
const groupIssuancesByStockPlanAndType = (issuances) => {
    return issuances.reduce((acc, issuance) => {
        const stockPlanId = issuance.stock_plan_id;
        const compensationType = issuance.compensation_type || 'Unknown';
        if (!acc[stockPlanId]) {
            acc[stockPlanId] = {};
        }
        if (!acc[stockPlanId][compensationType]) {
            acc[stockPlanId][compensationType] = [];
        }
        acc[stockPlanId][compensationType].push(issuance);
        return acc;
    }, {});
}
// Note: warrants only have fully diluted shares and fds %
const calculateWarrantAndNonPlanAwardSummary = (stockClasses, warrantIssuances, equityCompensationIssuancesWithoutStockPlan, totalOutstandingShares) => {
    console.log('warrantIssuances', warrantIssuances);
    console.log('equityCompensationIssuancesWithoutStockPlan', equityCompensationIssuancesWithoutStockPlan);

    /*
        {
            stockClassId1: [warrant1, warrant2, ...],
            general: [warrant3, warrant4, ...]
        }
    */
    const warrantsByStockClass = groupIssuancesByStockClass(warrantIssuances, 'exercise_triggers.0.conversion_right.converts_to_stock_class_id');
    const equityCompensationByStockClass = groupIssuancesByStockClass(equityCompensationIssuancesWithoutStockPlan, 'stock_class_id');

    console.log('warrantsByStockClass', warrantsByStockClass);
    console.log('equityCompensationByStockClass', equityCompensationByStockClass);

    const warrantRows = createWarrantAndNonPlanAwardsRow(warrantsByStockClass, stockClasses, totalOutstandingShares, 'Warrants', true);
    const equityCompensationRows = createWarrantAndNonPlanAwardsRow(equityCompensationByStockClass, stockClasses, totalOutstandingShares, 'Non-Plan Awards');

    console.log('warrantRows', warrantRows);
    console.log('equityCompensationRows', equityCompensationRows);

    return {
        rows: [...warrantRows, ...equityCompensationRows]
    }
};


const calculateStockPlanSummary = (stockPlans, equityCompensationIssuances, totalOutstandingShares) => {
    // Filter equity compensation issuances with stock plans
    const equityCompensationWithPlan = equityCompensationIssuances.filter(issuance => issuance.stock_plan_id);

    // Group issuances by stock plan
    const equityCompensationByStockPlanAndType = groupIssuancesByStockPlanAndType(equityCompensationWithPlan);


    const rows = createEquityCompensationWithPlanAndTypeSummaryRows(equityCompensationByStockPlanAndType, stockPlans, totalOutstandingShares);

    // Calculate total shares authorized and available for grants
    const totalSharesAuthorized = stockPlans.reduce((sum, plan) => sum + Number(plan.initial_shares_reserved), 0);
    const totalIssuedShares = equityCompensationWithPlan.reduce((sum, issuance) => sum + Number(issuance.quantity), 0);
    const availableForGrants = totalSharesAuthorized - totalIssuedShares;

    // Add the 'Available for Grants' row
    const finalRows = [
        ...rows,
    ];
    if(availableForGrants > 0) {
        finalRows.push({
            name: 'Available for Grants',
            fullyDilutedShares: availableForGrants
        })
    }

    return {
        totalSharesAuthorized,
        rows: finalRows
    };
}


const calculateAverageDiscount = (convertibles) => {
    const discounts = convertibles.map(c =>
        Number(get(c, 'conversion_triggers[0].conversion_right.conversion_mechanism.conversion_discount', 0))
    );
    return discounts.length > 0 ? discounts.reduce((a, b) => a + b) / discounts.length : 0;
}

const calculateAverageValuationCap = (convertibles) => {
    const caps = convertibles.map(c =>
        Number(get(c, 'conversion_triggers[0].conversion_right.conversion_mechanism.conversion_valuation_cap.amount', 0))
    ).filter(cap => cap > 0);  // Filter out zero values
    return caps.length > 0 ? caps.reduce((a, b) => a + b) / caps.length : 0;
}

const calculateAverageWarrantDiscount = (warrants) => {
    const discounts = warrants.map(w =>
        Number(get(w, 'conversion_triggers[0].conversion_right.conversion_mechanism.converts_to_percent', 0))
    );
    return discounts.length > 0 ? discounts.reduce((a, b) => a + b) / discounts.length : 0;
}

const calculateConvertibleSummary = (convertibles, stakeholders, warrantsTreatedAsConvertibles) => {

    console.log('convertibles', convertibles);
    console.log('warrantsTreatedAsConvertibles', warrantsTreatedAsConvertibles);

    // Create a map of stakeholder ids to legal names for quick lookup
    const stakeholderMap = stakeholders.reduce((acc, stakeholder) => {
        acc[stakeholder.id] = get(stakeholder, 'name.legal_name', 'Unknown Stakeholder');
        return acc;
    }, {});

    // Group convertibles by type (Pre-Money SAFE, Post-Money SAFE, Convertible Notes)
    const groupedConvertibles = convertibles.reduce((acc, convertible) => {
        let type;
        if (convertible.convertible_type === 'SAFE') {
            const conversionTiming = get(convertible, 'conversion_triggers[0].conversion_right.conversion_mechanism.conversion_timing', '');
            if (conversionTiming === 'PRE_MONEY') {
                type = 'Pre-Money SAFE';
            } else if (conversionTiming === 'POST_MONEY') {
                type = 'Post-Money SAFE';
            } else {
                type = 'Other SAFE';
            }
        } else if (convertible.convertible_type === 'NOTE') {
            type = 'Convertible Notes';
        } else {
            type = 'Other';
        }

        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(convertible);
        return acc;
    }, {});

    // Process each type of convertible
    const convertibleSummary = Object.entries(groupedConvertibles).reduce((acc, [type, convertibles]) => {
        const summary = {
            numberOfSecurities: convertibles.length,
            outstandingAmount: convertibles.reduce((sum, c) => sum + Number(get(c, 'investment_amount.amount', 0)), 0),
            discount: calculateAverageDiscount(convertibles),
            valuationCap: calculateAverageValuationCap(convertibles),
            rows: convertibles.map(c => ({
                name: `${type} - ${stakeholderMap[c.stakeholder_id] || 'Unknown Stakeholder'}`,
                numberOfSecurities: 1,
                outstandingAmount: Number(get(c, 'investment_amount.amount', 0)),
                discount: get(c, 'conversion_triggers[0].conversion_right.conversion_mechanism.conversion_discount', 0),
                valuationCap: get(c, 'conversion_triggers[0].conversion_right.conversion_mechanism.conversion_valuation_cap.amount', 0)
            }))
        };
        acc[type] = summary;
        return acc;
    }, {});

    // Process warrants treated as convertibles
    if (warrantsTreatedAsConvertibles.length > 0) {
        convertibleSummary['Warrants for future series of Preferred Stock'] = {
            numberOfSecurities: warrantsTreatedAsConvertibles.length,
            outstandingAmount: warrantsTreatedAsConvertibles.reduce((sum, w) => sum + Number(get(w, 'purchase_price.amount', 0)), 0),
            discount: calculateAverageWarrantDiscount(warrantsTreatedAsConvertibles),
            valuationCap: 0, // hardcoding for now
            rows: warrantsTreatedAsConvertibles.map(w => ({
                name: `Warrants for future series of Preferred Stock - ${stakeholderMap[w.stakeholder_id] || 'Unknown Stakeholder'}`,
                numberOfSecurities: 1,
                outstandingAmount: Number(get(w, 'purchase_price.amount', 0)),
                discount: get(w, 'conversion_triggers[0].conversion_right.conversion_mechanism.converts_to_percent', 0),
                valuationCap: 0
            }))
        };
    }

    console.log('convertibleSummary', convertibleSummary);

    return convertibleSummary;
}

const calculateCaptableStats = async (issuerId) => {
    // First Section: Stock Classes
    const stockClasses = await getAllStockClasses(issuerId);
    const stockIssuances = await getStockIssuances(issuerId);
    const warrantIssuances = await getAllWarrants(issuerId);
    const stakeholders = await getAllStakeholders(issuerId);

    const stockPlans = await getAllStockPlans(issuerId);
    const equityCompensationIssuances = await getAllEquityCompensationIssuances(issuerId);
    console.log('equityCompensationIssuances', equityCompensationIssuances);
    const equityCompensationIssuancesStockPlan = equityCompensationIssuances.filter(issuance => issuance.stock_plan_id && issuance.stock_plan_id !== '');
    const equityCompensationIssuancesWithoutStockPlan = equityCompensationIssuances.filter(issuance => !get(issuance, 'stock_plan_id', null));

    const warrantIssuancesStockClass = warrantIssuances.filter(issuance => get(issuance, 'exercise_triggers.0.conversion_right.converts_to_stock_class_id', null));
    // Warrants without a stock class are treated as convertibles.
    const warrantIssuancesWithoutStockClass = warrantIssuances.filter(issuance => !get(issuance, 'exercise_triggers.0.conversion_right.converts_to_stock_class_id', null));

    console.log('warrantsWithStockClass', warrantIssuancesStockClass);
    console.log('warrantsWithoutStockClass', warrantIssuancesWithoutStockClass);

    // Creates a map of stockClassId to the total number of shares issued
    const outstandingSharesByStockClass = stockIssuances.reduce((acc, issuance) => {
        const stockClassId = issuance.stock_class_id;
        if (!acc[stockClassId]) {
            acc[stockClassId] = 0;
        }
        acc[stockClassId] += Number(get(issuance, "quantity"));
        return acc;
    }, {});

    const totalOutstandingShares = stockIssuances.reduce((acc, issuance) => acc + Number(issuance.quantity), 0);

    const commonStockClasses = stockClasses.filter((stockClass) => stockClass.class_type === StockClassTypes.COMMON);
    const preferredStockClasses = stockClasses.filter((stockClass) => stockClass.class_type === StockClassTypes.PREFERRED);

    // only used for the voting % calculation
    const commonTotalVotingPower = calculateTotalVotingPower(commonStockClasses, outstandingSharesByStockClass);
    const preferredTotalVotingPower = calculateTotalVotingPower(preferredStockClasses, outstandingSharesByStockClass);
    const totalVotingPower = commonTotalVotingPower + preferredTotalVotingPower;

    // Second Section: Convertibles
    const convertibles = await getAllConvertibles(issuerId);
    // Warrants without a stock class are treated as convertibles.

    console.log('convertibles', convertibles);

    const commonSummary = calculateStockClassSummary(commonStockClasses, stockIssuances);
    const preferredSummary = calculateStockClassSummary(preferredStockClasses, stockIssuances, StockIssuanceTypes.FOUNDERS_STOCK);
    const founderPreferredSummary = calculateFounderPreferredSummary(preferredStockClasses, stockIssuances);
    const warrantsAndNonPlanAwardsSummary = calculateWarrantAndNonPlanAwardSummary(stockClasses, warrantIssuancesStockClass, equityCompensationIssuancesWithoutStockPlan, totalOutstandingShares);
    const stockPlansSummary = calculateStockPlanSummary(stockPlans, equityCompensationIssuancesStockPlan, totalOutstandingShares);

    const totalAuthorizedShares =
        commonSummary.totalSharesAuthorized +
        preferredSummary.totalSharesAuthorized +
        (founderPreferredSummary ? founderPreferredSummary.sharesAuthorized : 0) +
        (warrantsAndNonPlanAwardsSummary.totalSharesAuthorized || 0) +
        stockPlansSummary.totalSharesAuthorized;

    const totalFullyDilutedShares =
        commonSummary.rows.reduce((sum, row) => sum + row.fullyDilutedShares, 0) +
        preferredSummary.rows.reduce((sum, row) => sum + row.fullyDilutedShares, 0) +
        (founderPreferredSummary ? founderPreferredSummary.fullyDilutedShares : 0) +
        warrantsAndNonPlanAwardsSummary.rows.reduce((sum, row) => sum + row.fullyDilutedShares, 0) +
        stockPlansSummary.rows.reduce((sum, row) => sum + row.fullyDilutedShares, 0);

    console.log('totalFullyDilutedShares', totalFullyDilutedShares);


    // Function to recalculate percentages
    const recalculatePercentages = (summary) => {
        summary.rows.forEach(row => {
            row.fullyDilutedPercentage = ((row.fullyDilutedShares / totalFullyDilutedShares)).toFixed(4);
            if (row.votingPower !== undefined) {
                row.votingPercentage = ((row.votingPower / totalVotingPower)).toFixed(4);
            }
        });
        return summary;
    };


    // Recalculate percentages for all summaries
    const updatedCommonSummary = recalculatePercentages(commonSummary);
    const updatedPreferredSummary = recalculatePercentages(preferredSummary);
    const updatedWarrantsAndNonPlanAwardsSummary = recalculatePercentages(warrantsAndNonPlanAwardsSummary);
    const updatedStockPlansSummary = recalculatePercentages(stockPlansSummary);

    // Update founder preferred summary if it exists
    let updatedFounderPreferredSummary = null;
    if (founderPreferredSummary) {
        updatedFounderPreferredSummary = {
            ...founderPreferredSummary,
            fullyDilutedPercentage: ((founderPreferredSummary.fullyDilutedShares / totalFullyDilutedShares)).toFixed(4)
        };
    }

    console.log("new final summary ", updatedCommonSummary, updatedPreferredSummary, updatedWarrantsAndNonPlanAwardsSummary, updatedStockPlansSummary)

    // Calculate convertibles summary separately
    const convertiblesSummary = calculateConvertibleSummary(convertibles, stakeholders, warrantIssuancesWithoutStockClass);

    const totalOutstandingAmountConvertibles = Object.values(convertiblesSummary).reduce((sum, typeSummary) =>
        sum + typeSummary.outstandingAmount, 0
    );


    console.log("total outstanding shares ", totalOutstandingShares)
    return {
        summary: {
            isEmpty:
                get(updatedCommonSummary, "rows", []).length === 0 &&
                get(updatedPreferredSummary, "rows", []).length === 0 &&
                get(updatedFounderPreferredSummary, "rows", []).length === 0 &&
                get(updatedWarrantsAndNonPlanAwardsSummary, "rows", []).length === 0 &&
                get(updatedStockPlansSummary, "rows", []).length === 0,
            common: updatedCommonSummary,
            preferred: updatedPreferredSummary,
            founderPreferred: updatedFounderPreferredSummary,
            warrantsAndNonPlanAwards: updatedWarrantsAndNonPlanAwardsSummary,
            stockPlans: updatedStockPlansSummary,
            totals: {
                totalAuthorizedShares,
                totalOutstandingShares,
                totalFullyDilutedShares,
                totalFullyPercentage: 1,
                totalVotingPower,
                totalVotingPowerPercentage: 1,
            },
        },
        convertibles: {
            isEmpty: Object.keys(convertiblesSummary).length === 0,
            convertiblesSummary,
            totals: {
                outstandingAmount: totalOutstandingAmountConvertibles,
            },
        },
    };
};

export default calculateCaptableStats;
