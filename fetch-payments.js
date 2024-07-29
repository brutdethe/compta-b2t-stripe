const stripe = require('stripe');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');

// Load environment variables from .env.json
const env = JSON.parse(fs.readFileSync('.env.json', 'utf8'));
const stripeClient = stripe(env.STRIPE_PRIVATE);

/**
 * Fetches all payments from Stripe and generates a CSV file with accounting entries.
 */
async function fetchPaymentsAndGenerateCSV() {
    try {
        const csvWriter = createObjectCsvWriter({
            path: 'ecritures_comptables.csv',
            header: [
                { id: 'payer', title: 'qui paye ?' },
                { id: 'date', title: 'date' },
                { id: 'receiver', title: 'qui reçoit' },
                { id: 'post', title: 'poste' },
                { id: 'amount', title: 'montant' },
                { id: 'nature', title: 'nature' },
                { id: 'pointage', title: 'pointage' },
                { id: 'note', title: 'note' },
                { id: 'invoice', title: 'facture correspondante' },
            ]
        });

        let hasMore = true;
        let startingAfter = null;
        const records = [];

        while (hasMore) {
            const params = {
                limit: 100,
                ...(startingAfter && { starting_after: startingAfter }),
            };

            const payments = await stripeClient.charges.list(params);

            for (const payment of payments.data) {
                if (payment.paid && payment.status === 'succeeded') {
                    const balanceTransaction = await stripeClient.balanceTransactions.retrieve(payment.balance_transaction);
                    const date = new Date(payment.created * 1000).toISOString().split('T')[0];
                    const convertedDate = new Date(payment.created * 1000).toLocaleDateString('fr-FR');
                    const amount = (balanceTransaction.amount / 100).toFixed(2);
                    const fee = (balanceTransaction.fee / 100).toFixed(2);
                    const netAmount = (balanceTransaction.net / 100).toFixed(2);

                    let invoiceNumber = '';
                    if (payment.invoice) {
                        const invoice = await stripeClient.invoices.retrieve(payment.invoice);
                        invoiceNumber = invoice.number || '';
                    }

                    records.push({
                        payer: 'Membre',
                        date: date, // Using ISO format for sorting
                        receiver: 'Stripe',
                        post: 'ventes de marchandises',
                        amount: `${amount} €`,
                        nature: 'cb',
                        pointage: '',
                        note: 'Vente stripe',
                        invoice: invoiceNumber
                    }, {
                        payer: 'Stripe',
                        date: date, // Using ISO format for sorting
                        receiver: 'Stripe',
                        post: 'commissions',
                        amount: `${fee} €`,
                        nature: 'prv',
                        pointage: '',
                        note: 'commission stripe',
                        invoice: invoiceNumber
                    }, {
                        payer: 'Stripe',
                        date: date, // Using ISO format for sorting
                        receiver: 'B2T',
                        post: 'caisse stripe',
                        amount: `${netAmount} €`,
                        nature: 'cb',
                        pointage: 'x',
                        note: 'transfert stripe',
                        invoice: invoiceNumber
                    });
                }
            }

            hasMore = payments.has_more;
            if (hasMore) {
                startingAfter = payments.data[payments.data.length - 1].id;
            }
        }

        // Sort records by date
        records.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Convert dates back to localized format
        records.forEach(record => {
            record.date = new Date(record.date).toLocaleDateString('fr-FR');
        });

        await csvWriter.writeRecords(records);
        console.log('CSV file created successfully.');
    } catch (error) {
        console.error('Error fetching payments or generating CSV:', error);
    }
}

fetchPaymentsAndGenerateCSV();