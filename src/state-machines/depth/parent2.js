import { actions, createMachine, spawn, stop } from "xstate";
import { stockMachine } from "./stock.js";
const { assign } = actions;

const TX_TYPE_MAP = {
    'TX_STOCK_ISSUANCE': 'TX_STOCK_ISSUANCE',
    'TX_STOCK_TRANSFER': 'TX_STOCK_TRANSFER',
    'TX_STOCK_CANCELLATION': 'TX_STOCK_CANCELLATION',
    'TX_STOCK_RETRACTION': 'TX_STOCK_RETRACTION',
    'TX_STOCK_REISSUANCE': 'TX_STOCK_REISSUANCE',
    'TX_STOCK_REPURCHASE': 'TX_STOCK_REPURCHASE',
};

export const parentMachine = createMachine(
    {
        id: "Parent",
        initial: "ready",
        context: {
            securities: {},
            activePositions: {},
            activeSecurityIdsByStockClass: {},
            issuer: {},
            stockClasses: {},
            transactions: [],
        },
        predictableActionArguments: true,
        preserveActionOrder: true,
        states: {
            ready: {
                on: {
                    TX_SECURITY_ACTION: {
                        actions: ["processPreTransaction"],
                    },
                    IMPORT_ISSUER: {
                        actions: ["importIssuer"],
                    },
                    IMPORT_STOCK_CLASS: {
                        actions: ["importStockClass"],
                    },
                    VERIFY_STOCK_CLASSES_AUTHORIZED_SHARES: {
                        actions: ["verifyStockClassesAuthorizedShares"],
                    },
                    PRE_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT: {
                        actions: ["updateStockClassShares"],
                    },
                    PRE_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: {
                        actions: ["updateIssuerShares"],
                    },
                    PRE_STOCK_ISSUANCE: {
                        actions: ["spawnSecurity"],
                    },
                    UPDATE_CONTEXT: {
                        actions: ["updateParentContext"],
                    },
                    STOP_CHILD: {
                        actions: ["stopChild"],
                    },
                },
            },
        },
    },
    {
        actions: {
            importIssuer: assign((_, event) => ({
                issuer: {
                    shares_authorized: event.value.initial_shares_authorized || 0,
                    shares_issued: 0,
                },
            })),
            importStockClass: assign((context, event) => {
                const { id, initial_shares_authorized } = event.value;
                return {
                    stockClasses: {
                        ...context.stockClasses,
                        [id]: {
                            shares_authorized: initial_shares_authorized || 0,
                            shares_issued: 0,
                        },
                    },
                };
            }),
            verifyStockClassesAuthorizedShares: (context) => {
                const totalAuthorizedShares = totalSharesInStockClasses(context.stockClasses);
                const issuerAuthorizedShares = parseInt(context.issuer.shares_authorized, 10);

                if (totalAuthorizedShares > issuerAuthorizedShares) {
                    throw Error("Stock Classes authorized shares exceed Issuer's authorized shares");
                }
            },
            updateIssuerShares: assign({
                issuer: (context, event) => {
                    const quantityPerStockClass = sumQuantitiesByStockClass(context.activePositions);
                    const shares_issued = Object.values(quantityPerStockClass).reduce((total, quantity) => total + quantity, 0);

                    const { new_shares_authorized } = event.value;
                    if (new_shares_authorized && new_shares_authorized <= shares_issued) {
                        throw Error(`New Issuer shares authorized must be larger than current shares issued. Authorized: \
                        ${new_shares_authorized}, Issued: ${shares_issued}`);
                    }

                    const totalStockClassesSharesAuthorized = totalSharesInStockClasses(context.stockClasses);
                    if (new_shares_authorized < totalStockClassesSharesAuthorized) {
                        throw Error("Issuer's shares authorized cannot be less than the sum of stock classes' authorized shares.");
                    }

                    return {
                        shares_authorized: new_shares_authorized || context.issuer.shares_authorized,
                        shares_issued,
                    };
                },
            }),
            spawnSecurity: assign((context, event) => {
                const { value } = event;
                const { stock_class_id } = value;

                // Validate if stock_class_id exists
                if (!context.stockClasses[stock_class_id]) {
                    throw Error("Stock class not found in context");
                }

                const securityId = event.id;
                const newSecurity = spawn(stockMachine.withContext(value), securityId);

                return {
                    securities: {
                        ...context.securities,
                        [securityId]: newSecurity,
                    },
                    transactions: [...context.transactions, value],
                };
            }),
            updateStockClassShares: assign({
                stockClasses: (context, event) => {
                    const { stock_class_id, new_shares_authorized } = event.value;
                    const quantityPerStockClass = sumQuantitiesByStockClass(context.activePositions);
                    const shares_issued = quantityPerStockClass[stock_class_id] || 0;

                    if (new_shares_authorized && new_shares_authorized <= shares_issued) {
                        throw Error(`New Stock Class shares authorized must be larger than current shares issued. Authorized: \
                        ${new_shares_authorized}, Issued: ${shares_issued}`);
                    }

                    if (new_shares_authorized > context.issuer.shares_authorized) {
                        throw Error("Stock Class shares authorized cannot exceed Issuer's shares authorized");
                    }

                    return {
                        ...context.stockClasses,
                        [stock_class_id]: {
                            shares_authorized: new_shares_authorized || context.stockClasses[stock_class_id].shares_authorized,
                            shares_issued,
                        },
                    };
                },
            }),
            updateParentContext: assign({
                activePositions: (context, event) => {
                    const updatedActivePositions = { ...context.activePositions };

                    for (const stakeholderId in event.value.activePositions) {
                        updatedActivePositions[stakeholderId] = {
                            ...updatedActivePositions[stakeholderId],
                            ...event.value.activePositions[stakeholderId],
                        };
                    }

                    return updatedActivePositions;
                },
                activeSecurityIdsByStockClass: (context, event) => {
                    const updatedSecurityIdsByStockClass = { ...context.activeSecurityIdsByStockClass };

                    for (const stakeholderId in event.value.activeSecurityIdsByStockClass) {
                        for (const stockClassId in event.value.activeSecurityIdsByStockClass[stakeholderId]) {
                            const existingIds = updatedSecurityIdsByStockClass[stakeholderId]?.[stockClassId] || [];
                            const newIds = event.value.activeSecurityIdsByStockClass[stakeholderId][stockClassId];

                            updatedSecurityIdsByStockClass[stakeholderId] = {
                                ...updatedSecurityIdsByStockClass[stakeholderId],
                                [stockClassId]: [...new Set([...existingIds, ...newIds])],
                            };
                        }
                    }

                    return updatedSecurityIdsByStockClass;
                },
            }),
            processPreTransaction: assign((context, event) => {
                const { security_id, object_type, ...rest } = event.value;
                const securityActor = context.securities[security_id];

                if (!securityActor) {
                    throw new Error(`No security found for ID: ${security_id}`);
                }

                // Map OCF transaction types to state machine events
                const txType = TX_TYPE_MAP[object_type];

                // Send event to the child state machine
                securityActor.send({
                    type: txType,
                    security_id,
                    ...rest,
                });

                // Update transactions in the parent context
                return {
                    transactions: [...context.transactions, event.value],
                };
            }),
            stopChild: assign((context, event) => {
                const { security_id } = event.value;
                const transferorIssuance = context.transactions.find(tx => tx.security_id === security_id);
                const { stakeholder_id, stock_class_id } = transferorIssuance || {};

                delete context.securities[security_id];
                delete context.activePositions[stakeholder_id]?.[security_id];

                const activeSecuritiesByStockClass = (context.activeSecurityIdsByStockClass[stakeholder_id]?.[stock_class_id] || [])
                    .filter(id => id !== security_id);

                context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id] = activeSecuritiesByStockClass;

                if (activeSecuritiesByStockClass.length === 0) {
                    delete context.activeSecurityIdsByStockClass[stakeholder_id][stock_class_id];
                }

                stop(security_id);
                return { ...context };
            }),
        },
    }
);

// Utility functions remain unchanged
function totalSharesInStockClasses(stockClasses) {
    return Object.keys(stockClasses).reduce((total, id) => {
        const stockClass = stockClasses[id];
        return total + parseInt(stockClass.shares_authorized, 10);
    }, 0);
}

function sumQuantitiesByStockClass(activePositions) {
    return Object.keys(activePositions).reduce((result, stakeholderId) => {
        const positions = activePositions[stakeholderId];

        Object.keys(positions).forEach(positionId => {
            const position = positions[positionId];
            const stockClassId = position.stock_class_id;
            result[stockClassId] = (result[stockClassId] || 0) + parseInt(position.quantity, 10);
        });

        return result;
    }, {});
}