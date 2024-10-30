import { from } from 'rxjs';
import { scan, tap, last } from 'rxjs/operators';
import { getAllStateMachineObjectsById } from "../db/operations/read.js";

// Initial state structure
const createInitialState = (issuer, stockClasses, stockPlans) => ({
    issuer: {
        id: issuer._id,
        sharesAuthorized: parseInt(issuer.initial_shares_authorized),
        sharesIssued: 0
    },
    stockClasses: stockClasses.reduce((acc, sc) => ({
        ...acc,
        [sc._id]: {
            id: sc._id,
            sharesAuthorized: parseInt(sc.initial_shares_authorized),
            sharesIssued: 0
        }
    }), {}),
    stockPlans: {
        'no-stock-plan': {
            id: 'no-stock-plan',
            sharesReserved: 0,
            sharesIssued: 0,
            name: 'Unassigned Stock Plan'
        },
        ...stockPlans.reduce((acc, sp) => ({
            ...acc,
            [sp._id]: {
                id: sp._id,
                sharesReserved: parseInt(sp.initial_shares_reserved),
                sharesIssued: 0,
                stockClassIds: sp.stock_class_ids,
                name: sp.plan_name
            }
        }), {})
    },
    equityCompensation: {
        exercises: {},
    },
    transactions: [],
    errors: [],
    positions: []
});

// Process transactions
const processTransaction = (state, transaction) => {
    const newState = {
        ...state,
        transactions: [...state.transactions, transaction]
    };

    switch (transaction.object_type) {
        case 'TX_STOCK_ISSUANCE':
            return processStockIssuance(newState, transaction);
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
        default:
            return state;
    }
};

// Process stock issuance
const processStockIssuance = (state, transaction) => {
    const { stock_class_id, quantity, stakeholder_id, share_price } = transaction;
    const numShares = parseInt(quantity);
    const stockClass = state.stockClasses[stock_class_id];

    // Validate
    if (stockClass.sharesIssued + numShares > stockClass.sharesAuthorized) {
        return {
            ...state,
            errors: [...state.errors, `Cannot issue ${numShares} shares - exceeds stock class authorized amount`]
        };
    }

    if (state.issuer.sharesIssued + numShares > state.issuer.sharesAuthorized) {
        return {
            ...state,
            errors: [...state.errors, `Cannot issue ${numShares} shares - exceeds issuer authorized amount`]
        };
    }

    // Find existing position or create new one
    const existingPositionIndex = state.positions.findIndex(
        p => p.stakeholderId === stakeholder_id && p.stockClassId === stock_class_id
    );

    let updatedPositions;
    if (existingPositionIndex >= 0) {
        // Update existing position
        updatedPositions = state.positions.map((position, index) =>
            index === existingPositionIndex
                ? {
                    ...position,
                    quantity: position.quantity + numShares,
                    sharePrice: share_price
                }
                : position
        );
    } else {
        // Add new position
        updatedPositions = [
            ...state.positions,
            {
                stakeholderId: stakeholder_id,
                stockClassId: stock_class_id,
                quantity: numShares,
                sharePrice: share_price
            }
        ];
    }

    // Update state
    return {
        ...state,
        issuer: {
            ...state.issuer,
            sharesIssued: state.issuer.sharesIssued + numShares
        },
        stockClasses: {
            ...state.stockClasses,
            [stock_class_id]: {
                ...stockClass,
                sharesIssued: stockClass.sharesIssued + numShares
            }
        },
        positions: updatedPositions
    };
};

// Process issuer adjustment
const processIssuerAdjustment = (state, transaction) => {
    return {
        ...state,
        issuer: {
            ...state.issuer,
            sharesAuthorized: parseInt(transaction.new_shares_authorized)
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
    const { stock_plan_id, quantity } = transaction;
    const numShares = parseInt(quantity);

    // Use no-stock-plan for missing or zero stock plan IDs
    const effectiveStockPlanId = (!stock_plan_id || stock_plan_id === '00000000-0000-0000-0000-000000000000')
        ? 'no-stock-plan'
        : stock_plan_id;

    const stockPlan = state.stockPlans[effectiveStockPlanId];

    // Update stock plan
    return {
        ...state,
        stockPlans: {
            ...state.stockPlans,
            [effectiveStockPlanId]: {
                ...stockPlan,
                sharesIssued: stockPlan.sharesIssued + numShares
            }
        }
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
    const { security_id, quantity, resulting_security_ids } = transaction;
    const numShares = parseInt(quantity);

    // Just check security_id match
    const equityGrant = state.transactions.find(tx => tx.security_id === security_id);

    if (!equityGrant) {
        return {
            ...state,
            errors: [...state.errors, `Exercise references non-existent equity grant: ${security_id}`]
        };
    }

    // Same for stock issuance
    const stockIssuance = state.transactions.find(tx =>
        resulting_security_ids.includes(tx.security_id)
    );

    if (!stockIssuance) {
        return {
            ...state,
            errors: [...state.errors, `Exercise references non-existent stock issuance: ${resulting_security_ids}`]
        };
    }

    // Track exercise in state
    return {
        ...state,
        equityCompensation: {
            ...state.equityCompensation,
            exercises: {
                ...state.equityCompensation.exercises,
                [security_id]: {
                    exercised: (state.equityCompensation.exercises[security_id]?.exercised || 0) + numShares,
                    stockSecurityId: resulting_security_ids[0]
                }
            }
        }
    };
};

export const rxjs = async (issuerId) => {
    const { issuer, stockClasses, stockPlans, transactions } = await getAllStateMachineObjectsById(issuerId);

    console.log("stockPlans", stockPlans);
    // Create observable from transactions
    const transactions$ = from(transactions).pipe(
        scan(processTransaction, createInitialState(issuer, stockClasses, stockPlans)),
        last(),
        tap(state => {
            console.log('\nProcessed transaction. New state:', {
                issuerShares: state.issuer.sharesIssued,
                issuerAuthorized: state.issuer.sharesAuthorized,
                stockClasses: Object.entries(state.stockClasses).map(([id, data]) => ({
                    id,
                    authorized: data.sharesAuthorized,
                    issued: data.sharesIssued
                })),
                stockPlans: Object.entries(state.stockPlans).map(([id, data]) => ({
                    id: id,
                    name: data.name,
                    reserved: parseInt(data.sharesReserved),
                    issued: data.sharesIssued
                })),
                exercises: Object.entries(state.equityCompensation.exercises).map(([id, data]) => ({
                    grantSecurityId: id,
                    exercised: data.exercised,
                    stockSecurityId: data.stockSecurityId
                })),
                positions: state.positions.map(position => ({
                    stakeholderId: position.stakeholderId,
                    stockClassId: position.stockClassId,
                    quantity: position.quantity,
                    sharePrice: position.sharePrice
                }))
            });
            if (state.errors.length > 0) {
                console.log('Errors:', state.errors);
            }
        })
    );

    // Subscribe to process transactions
    transactions$.subscribe();
};