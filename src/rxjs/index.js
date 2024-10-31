import { from, lastValueFrom } from 'rxjs';
import { scan, tap, last, map } from 'rxjs/operators';
import { getAllStateMachineObjectsById } from "../db/operations/read.js";

// Initial state structure
const createInitialState = (issuer, stockClasses, stockPlans, stakeholders) => ({
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
    sharesIssuedByCurrentRelationship: {},
    errors: [],
    positions: [],
    transactions: [],
    numOfStakeholders: stakeholders.length,
    totalRaised: 0,
    latestSharePrice: 0,
    valuations: {
        stock: null,  // { amount, createdAt, type: 'STOCK' }
        convertible: null,  // { amount, createdAt, type: 'CONVERTIBLE' }
    },
});

// Process transactions
const processTransaction = (state, transaction, stakeholders) => {
    const newState = {
        ...state,
        transactions: [...state.transactions, transaction]
    };

    switch (transaction.object_type) {
        case 'TX_STOCK_ISSUANCE':
            return processStockIssuance(newState, transaction, stakeholders);
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
            return processConvertibleIssuance(newState, transaction, stakeholders);
        default:
            return state;
    }
};

// Process convertible issuance
const processConvertibleIssuance = (state, transaction, stakeholders) => {
    const { investment_amount, stakeholder_id } = transaction;
    const stakeholder = stakeholders.find(s => s.id === stakeholder_id);

    // Only count towards totalRaised if not FOUNDER or BOARD_MEMBER
    const shouldCountTowardsRaised = stakeholder &&
        !['FOUNDER', 'BOARD_MEMBER'].includes(stakeholder.current_relationship);
    const amountToAdd = shouldCountTowardsRaised ? Number(investment_amount.amount) : 0;

    const conversionTriggers = transaction.conversion_triggers || [];
    let conversionValuationCap = null;

    // Look for SAFE conversion with valuation cap
    conversionTriggers.forEach(trigger => {
        if (trigger.conversion_right?.type === "CONVERTIBLE_CONVERSION_RIGHT" &&
            trigger.conversion_right?.conversion_mechanism?.type === "SAFE_CONVERSION") {
            conversionValuationCap = trigger.conversion_right.conversion_mechanism.conversion_valuation_cap?.amount;
        }
    });

    // Only update if we found a valuation cap
    const newValuation = conversionValuationCap ? {
        type: 'CONVERTIBLE',
        amount: Number(conversionValuationCap),
        createdAt: transaction.createdAt
    } : state.valuations.convertible;

    return {
        ...state,
        totalRaised: state.totalRaised + amountToAdd,
        sharesIssuedByCurrentRelationship: {
            ...state.sharesIssuedByCurrentRelationship,
            [stakeholder.current_relationship]: (state.sharesIssuedByCurrentRelationship[stakeholder.current_relationship] || 0)
        },
        valuations: {
            ...state.valuations,
            convertible: newValuation
        }
    };
};

// Process stock issuance
const processStockIssuance = (state, transaction, stakeholders) => {
    const { stock_class_id, stakeholder_id, share_price, quantity } = transaction;
    const stakeholder = stakeholders.find(s => s.id === stakeholder_id);
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

    // Check if stakeholder is founder/board member
    const shouldCountTowardsRaised = stakeholder &&
        !['FOUNDER', 'BOARD_MEMBER'].includes(stakeholder.current_relationship);
    const amountToAdd = shouldCountTowardsRaised ? (numShares * Number(share_price.amount)) : 0;

    // Calculate non-founder/board shares for valuation
    const nonFounderShares = Object.entries(state.sharesIssuedByCurrentRelationship)
        .filter(([relationship, _]) => !['FOUNDER', 'BOARD_MEMBER'].includes(relationship))
        .reduce((acc, [_, shares]) => acc + shares, 0);

    // Only update valuation if it counts
    const newValuation = shouldCountTowardsRaised ? {
        type: 'STOCK',
        amount: (nonFounderShares + numShares) * Number(share_price.amount),
        createdAt: transaction.createdAt
    } : state.valuations.stock;

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
        sharesIssuedByCurrentRelationship: {
            ...state.sharesIssuedByCurrentRelationship,
            [stakeholder.current_relationship]: (state.sharesIssuedByCurrentRelationship[stakeholder.current_relationship] || 0) + numShares
        },
        totalRaised: state.totalRaised + amountToAdd,
        latestSharePrice: share_price?.amount || state.latestSharePrice,
        valuations: {
            ...state.valuations,
            stock: newValuation
        }
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
    const { issuer, stockClasses, stockPlans, stakeholders, transactions } = await getAllStateMachineObjectsById(issuerId);

    console.log("stockPlans", stockPlans);

    const finalState = await lastValueFrom(from(transactions).pipe(
        scan((state, transaction) => processTransaction(state, transaction, stakeholders),
            createInitialState(issuer, stockClasses, stockPlans, stakeholders)),
        last(),
        tap(state => {
            const { transactions, ...stateWithoutTransactions } = state;
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