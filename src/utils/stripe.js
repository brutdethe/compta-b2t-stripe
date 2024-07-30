const stripe = require('stripe');
const env = JSON.parse(require('fs').readFileSync('.env.json', 'utf8'));
const stripeClient = stripe(env.STRIPE_PRIVATE);

const getItemsDescription = async payment => {
    let items = '';

    if (payment.invoice) {
        const invoiceItems = await stripeClient.invoiceItems.list({ invoice: payment.invoice });
        items = invoiceItems.data.map(item => item.description).join(', ');
    }

    if (payment.payment_intent) {
        const sessionList = await stripeClient.checkout.sessions.list({ payment_intent: payment.payment_intent });
        if (sessionList.data.length > 0) {
            const session = sessionList.data[0];
            const lineItems = await stripeClient.checkout.sessions.listLineItems(session.id);
            items = lineItems.data.map(item => item.description).join(', ');
        }
    }

    return items;
};

const fetchPayments = async(params, startingAfter) => {
    return await stripeClient.charges.list({
        ...params,
        ...(startingAfter && { starting_after: startingAfter })
    });
};

const fetchBalanceTransaction = async balanceTransactionId => {
    return await stripeClient.balanceTransactions.retrieve(balanceTransactionId);
};

const fetchInvoice = async invoiceId => {
    return await stripeClient.invoices.retrieve(invoiceId);
};

module.exports = {
    getItemsDescription,
    fetchPayments,
    fetchBalanceTransaction,
    fetchInvoice
};