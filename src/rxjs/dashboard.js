

export const dashboardInitialState = (issuer, stockClasses, stockPlans, stakeholders) => {
    return {
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
        positions: [],
        numOfStakeholders: stakeholders.length,
        totalRaised: 0,
        latestSharePrice: 0,
        valuations: {
            stock: null,  // { amount, createdAt, type: 'STOCK' }
            convertible: null,  // { amount, createdAt, type: 'CONVERTIBLE' }
        },
    }
}

export const processDashboardConvertibleIssuance = (state, transaction, stakeholder) => {
    const { investment_amount } = transaction;
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

}

export const processDashboardStockIssuance = (state, transaction, stakeholder) => {
    const { stock_class_id, share_price, quantity } = transaction;
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
    }
}

export const processDashboardEquityCompensationExercise = (state, transaction) => {
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
    }
}