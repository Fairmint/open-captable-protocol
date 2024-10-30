import { interpret } from 'xstate';
import { createStockIssuanceMachine } from './stockIssuance.js';
import { getAllStateMachineObjectsById } from '../../db/operations/read.js';

export const testStockIssuance = async (issuerId) => {
    const { issuer, stockClasses, stockIssuances } = await getAllStateMachineObjectsById(issuerId);

    const oneIssuance = stockIssuances[0];

    console.log('Initial Data:', {
        issuer: {
            id: issuer._id,
            authorizedShares: issuer.initial_shares_authorized
        },
        stockClasses: stockClasses.map(sc => ({
            id: sc._id,
            authorizedShares: sc.initial_shares_authorized
        })),
        issuanceCount: stockIssuances.length
    });

    const machine = createStockIssuanceMachine(issuer, stockClasses);
    const service = interpret(machine)
        .onTransition(state => {
            if (state.changed) {
                console.log('\nState:', state.value);
                console.log('Context:', {
                    issuerShares: state.context.issuer.sharesIssued,
                    stockClasses: Object.entries(state.context.stockClasses).map(([id, data]) => ({
                        id,
                        authorized: data.sharesAuthorized,
                        issued: data.sharesIssued
                    }))
                });
                if (state.context.errors.length > 0) {
                    console.log('Errors:', state.context.errors);
                }
            }
        })
        .start();

    // Process each stock issuance chronologically
    const sortedIssuances = stockIssuances.sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );

    // for (const issuance of sortedIssuances) {
    //     console.log('\nProcessing issuance:', {
    //         date: issuance.date,
    //         quantity: issuance.quantity,
    //         stockClassId: issuance.stock_class_id
    //     });

    //     service.send({
    //         type: 'ISSUE',
    //         data: issuance
    //     });
    // }

    service.send({
        type: 'ISSUE',
        data: oneIssuance
    });

    return service.getSnapshot().context;
};
