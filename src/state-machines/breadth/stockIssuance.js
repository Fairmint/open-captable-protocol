import { createMachine, assign } from 'xstate';

const createStockIssuanceMachine = (issuer, stockClasses) => {
    // Initial context
    const initialContext = {
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
                sharesIssued: 0,
                type: sc.class_type
            }
        }), {}),
        transactions: [],
        errors: []
    };

    return createMachine({
        predictableActionArguments: true,
        id: 'stockIssuance',
        initial: 'idle',
        context: initialContext,
        states: {
            idle: {
                on: {
                    ISSUE: {
                        target: 'validating',
                        actions: assign({
                            transactions: (context, event) => [...context.transactions, event.data]
                        })
                    }
                }
            },
            validating: {
                entry: ['validateShares'],
                always: [
                    {
                        target: 'issuing',
                        cond: (context) => context.errors.length === 0
                    },
                    {
                        target: 'error'
                    }
                ]
            },
            issuing: {
                entry: ['issueShares'],
                always: 'idle'
            },
            error: {
                type: 'final',
                entry: assign((context) => {
                    const lastTx = context.transactions[context.transactions.length - 1];
                    console.error('Stock issuance validation failed:', {
                        transaction: {
                            date: lastTx.date,
                            quantity: lastTx.quantity,
                            stockClassId: lastTx.stock_class_id
                        },
                        errors: context.errors
                    });
                    return context;
                })
            }
        }
    }, {
        actions: {
            validateShares: assign((context) => {
                const data = context.transactions[context.transactions.length - 1];
                if (!data) {
                    return {
                        errors: [...context.errors, 'No transaction data found']
                    };
                }

                const { stock_class_id, quantity } = data;
                const stockClass = context.stockClasses[stock_class_id];
                if (!stockClass) {
                    return {
                        errors: [...context.errors, `Stock class ${stock_class_id} not found`]
                    };
                }

                const numShares = parseInt(quantity);
                const errors = [];

                // Check stock class has enough authorized shares
                if (stockClass.sharesIssued + numShares > stockClass.sharesAuthorized) {
                    errors.push(`Stock class ${stock_class_id} does not have enough authorized shares. Attempted to issue ${numShares} but only ${stockClass.sharesAuthorized - stockClass.sharesIssued} available`);
                }

                // Check issuer has enough authorized shares
                if (context.issuer.sharesIssued + numShares > context.issuer.sharesAuthorized) {
                    errors.push(`Issuer does not have enough authorized shares. Attempted to issue ${numShares} but only ${context.issuer.sharesAuthorized - context.issuer.sharesIssued} available`);
                }

                return {
                    errors: [...context.errors, ...errors]
                };
            }),
            issueShares: assign((context) => {
                const data = context.transactions[context.transactions.length - 1];
                const { stock_class_id, quantity } = data;
                const numShares = parseInt(quantity);

                return {
                    stockClasses: {
                        ...context.stockClasses,
                        [stock_class_id]: {
                            ...context.stockClasses[stock_class_id],
                            sharesIssued: context.stockClasses[stock_class_id].sharesIssued + numShares
                        }
                    },
                    issuer: {
                        ...context.issuer,
                        sharesIssued: context.issuer.sharesIssued + numShares
                    }
                };
            })
        }
    });
};

export { createStockIssuanceMachine }; 