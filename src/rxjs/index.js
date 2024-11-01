import { from, lastValueFrom } from 'rxjs';
import { scan, tap, last, map } from 'rxjs/operators';
import { getAllStateMachineObjectsById } from "../db/operations/read.js";
import { dashboardInitialState, processDashboardConvertibleIssuance, processDashboardEquityCompensationExercise, processDashboardStockIssuance } from "./dashboard.js";
import { captableInitialState, processCaptableStockIssuance, processCaptableEquityCompensationIssuance } from './captable.js';

// Initial state structure
const createInitialState = (issuer, stockClasses, stockPlans, stakeholders) => {
    // First create the dashboard state
    const dashboardState = dashboardInitialState(issuer, stockClasses, stockPlans, stakeholders);

    // Create captable state
    const captableState = captableInitialState(issuer, stockClasses, stockPlans, stakeholders);

    return {
        ...dashboardState,
        ...captableState,  // Add captable specific state
        transactions: [],  // Reset transactions array
        errors: []  // Reset errors array
    };
};

// Process transactions
const processTransaction = (state, transaction, stakeholders, stockClasses) => {
    const newState = {
        ...state,
        transactions: [...state.transactions, transaction]
    };

    const stakeholder = stakeholders.find(s => s.id === transaction.stakeholder_id);
    const stockClass = stockClasses.find(sc => sc._id === transaction.stock_class_id);


    switch (transaction.object_type) {
        case 'TX_STOCK_ISSUANCE':
            return processStockIssuance(newState, transaction, stakeholder, stockClass);
        case 'TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT':
            return processIssuerAdjustment(newState, transaction);
        case 'TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT':
            return processStockClassAdjustment(newState, transaction);
        case 'TX_EQUITY_COMPENSATION_ISSUANCE':
            return processEquityCompensationIssuance(newState, transaction);
        case 'TX_STOCK_PLAN_POOL_ADJUSTMENT':
            return processStockPlanAdjustment(newState, transaction);
        case 'TX_EQUITY_COMPENSATION_EXERCISE':
            return processEquityCompensationExercise(newState, transaction);
        case 'TX_CONVERTIBLE_ISSUANCE':
            return processConvertibleIssuance(newState, transaction, stakeholder);
        default:
            return state;
    }
};

// Process convertible issuance
const processConvertibleIssuance = (state, transaction, stakeholder) => {


    const dashboardState = processDashboardConvertibleIssuance(state, transaction, stakeholder);

    return {
        ...dashboardState
    }

};

// Process stock issuance
const processStockIssuance = (state, transaction, stakeholder, stockClass) => {
    // Process for dashboard stats
    const dashboardState = processDashboardStockIssuance(state, transaction, stakeholder);



    // Process for captable stats with original stock class data
    const captableState = processCaptableStockIssuance(dashboardState, transaction, stakeholder, stockClass);

    return {
        ...captableState
    };
};

// Process issuer adjustment
const processIssuerAdjustment = (state, transaction) => {
    const newSharesAuthorized = parseInt(transaction.new_shares_authorized);

    return {
        ...state,
        issuer: {
            ...state.issuer,
            sharesAuthorized: newSharesAuthorized
        },
        summary: {
            ...state.summary,
            totals: {
                ...state.summary.totals,
                totalAuthorizedShares: newSharesAuthorized
            }
        }
    };
};

// Process stock class adjustment
const processStockClassAdjustment = (state, transaction) => {
    const { stock_class_id, new_shares_authorized } = transaction;
    return {
        ...state,
        stockClasses: {
            ...state.stockClasses,
            [stock_class_id]: {
                ...state.stockClasses[stock_class_id],
                sharesAuthorized: parseInt(new_shares_authorized)
            }
        }
    };
};

// Process equity compensation issuance
const processEquityCompensationIssuance = (state, transaction) => {
    // Process for dashboard stats
    const dashboardState = processEquityCompensationIssuance(state, transaction);

    // Find original stock class data
    const originalStockClass = stockClasses.find(sc => sc._id === transaction.stock_class_id);

    // Process for captable stats
    const captableState = processCaptableEquityCompensationIssuance(dashboardState, transaction, originalStockClass);

    return {
        ...captableState
    };
};

// Process stock plan adjustment
const processStockPlanAdjustment = (state, transaction) => {
    const { stock_plan_id, shares_reserved } = transaction;
    return {
        ...state,
        stockPlans: {
            ...state.stockPlans,
            [stock_plan_id]: {
                ...state.stockPlans[stock_plan_id],
                sharesReserved: parseInt(shares_reserved)
            }
        }
    };
};

// Process equity compensation exercise
const processEquityCompensationExercise = (state, transaction) => {
    const dashboardState = processDashboardEquityCompensationExercise(state, transaction);

    return {
        ...dashboardState
    }
};

export const dashboardStats = async (issuerId) => {
    const { issuer, stockClasses, stockPlans, stakeholders, transactions } = await getAllStateMachineObjectsById(issuerId);

    console.log("stockPlans", stockPlans);

    const finalState = await lastValueFrom(from(transactions).pipe(
        scan((state, transaction) => processTransaction(state, transaction, stakeholders, stockClasses),
            createInitialState(issuer, stockClasses, stockPlans, stakeholders)),
        last(),
        tap(state => {
            const stateWithoutTransactions = { ...state };
            delete stateWithoutTransactions.transactions;
            console.log('\nProcessed transaction. New state:', JSON.stringify(stateWithoutTransactions, null, 2));
            if (state.errors.length > 0) {
                console.log('Errors:', state.errors);
            }
        }),
        map((state) => {
            // Calculate ownership percentages
            const ownership = Object.entries(state.sharesIssuedByCurrentRelationship)
                .reduce((acc, [relationship, shares]) => ({
                    ...acc,
                    [relationship]: state.issuer.sharesIssued > 0
                        ? Number((shares / state.issuer.sharesIssued).toFixed(4)) // 4 decimal places
                        : 0
                }), {});

            // Get most recent valid valuation
            const validValuations = [state.valuations.stock, state.valuations.convertible]
                .filter(v => v && v.amount)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            console.log("validValuations", validValuations);

            return {
                numOfStakeholders: state.numOfStakeholders,
                totalRaised: state.totalRaised,
                totalStockPlanAuthorizedShares: Object.entries(state.stockPlans)
                    .filter(([id, _]) => id !== 'no-stock-plan')
                    .reduce((acc, [_, plan]) => acc + parseInt(plan.sharesReserved), 0),
                sharesIssuedByCurrentRelationship: state.sharesIssuedByCurrentRelationship,
                totalIssuerAuthorizedShares: state.issuer.sharesAuthorized,
                latestSharePrice: Number(state.latestSharePrice),
                ownership,
                valuation: validValuations[0] || null
            };
        })
    ));

    console.log("finalState", finalState);

    return finalState;
};

export const captableStats = async (issuerId) => {
    const { issuer, stockClasses, stockPlans, stakeholders, transactions } = await getAllStateMachineObjectsById(issuerId);

    const finalState = await lastValueFrom(from(transactions).pipe(
        scan((state, transaction) => processTransaction(state, transaction, stakeholders, stockClasses),
            createInitialState(issuer, stockClasses, stockPlans, stakeholders)),
        last(),
        tap(state => {
            const stateWithoutTransactions = { ...state };
            delete stateWithoutTransactions.transactions;
            console.log('\nProcessed transaction. New state:', JSON.stringify(stateWithoutTransactions, null, 2));
            if (state.errors.length > 0) {
                console.log('Errors:', state.errors);
            }
        }),
        map((state) => ({
            isCapTableEmpty: state.isCapTableEmpty,
            summary: state.summary,
            convertibles: state.convertibles
        }))
    ));

    console.log("finalState", finalState);

    return finalState;
};