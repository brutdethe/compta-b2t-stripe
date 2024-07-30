const stripe = require('stripe');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const process = require('process');

// Load environment variables from .env.json
const env = JSON.parse(fs.readFileSync('.env.json', 'utf8'));
const stripeClient = stripe(env.STRIPE_PRIVATE);

const createDirectoryIfNotExists = dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const dateToUnixTimestamp = dateString => Math.floor(new Date(dateString).getTime() / 1000);

const formatDate = timestamp => {
    const date = new Date(timestamp * 1000);
    return date.toISOString().split('T')[0].replace(/-/g, '');
};

const determinePostType = items => {
    const lowerItems = items.toLowerCase();
    if (lowerItems.includes('formation') || lowerItems.includes('cérémonie')) {
        return 'prestations de services';
    }
    if (lowerItems.includes('billet') || lowerItems.includes('cotisation') || lowerItems.includes('adhésion')) {
        return 'cotisations';
    }
    if (lowerItems.includes('don')) {
        return 'dons manuels';
    }
    return 'ventes de marchandises';
};

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

const generateCSV = async(fileName, records) => {
    const csvWriter = createObjectCsvWriter({
        path: fileName,
        header: [
            { id: 'payer', title: 'qui paye ?' },
            { id: 'date', title: 'date' },
            { id: 'receiver', title: 'qui reçoit' },
            { id: 'post', title: 'poste' },
            { id: 'amount', title: 'montant' },
            { id: 'nature', title: 'nature' },
            { id: 'pointage', title: 'pointage' },
            { id: 'note', title: 'note' },
            { id: 'invoice', title: 'facture correspondante' }
        ]
    });

    // Sort records by date
    records.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Convert dates back to localized format
    records.forEach(record => {
        record.date = new Date(record.date).toLocaleDateString('fr-FR');
    });

    await csvWriter.writeRecords(records);
    console.log(`CSV file ${fileName} created successfully.`);
};

const fetchPaymentsAndGenerateCSV = async(startDate, endDate, startDateString, endDateString) => {
    try {
        const directory = 'generated_reports';
        createDirectoryIfNotExists(directory);
        const fileName = `${directory}/ecritures_comptables_${startDateString}_to_${endDateString}.csv`;

        let hasMore = true;
        let startingAfter = null;
        const records = [];

        while (hasMore) {
            const params = {
                limit: 100,
                created: { gte: startDate, lte: endDate },
                ...(startingAfter && { starting_after: startingAfter })
            };

            const payments = await stripeClient.charges.list(params);

            for (const payment of payments.data) {
                if (payment.paid && payment.status === 'succeeded') {
                    const balanceTransaction = await stripeClient.balanceTransactions.retrieve(payment.balance_transaction);
                    const date = new Date(payment.created * 1000).toISOString().split('T')[0];
                    const formattedDate = formatDate(payment.created);
                    const amount = (balanceTransaction.amount / 100).toFixed(2);
                    const fee = (balanceTransaction.fee / 100).toFixed(2);
                    const netAmount = (balanceTransaction.net / 100).toFixed(2);
                    const items = await getItemsDescription(payment);
                    const postType = determinePostType(items);

                    let invoiceNumber = '';
                    if (payment.invoice) {
                        const invoice = await stripeClient.invoices.retrieve(payment.invoice);
                        invoiceNumber = `${formattedDate}_${invoice.number || ''}`;
                    }

                    records.push({
                        payer: 'Membre',
                        date: date,
                        receiver: 'Stripe',
                        post: postType,
                        amount: `${amount} €`,
                        nature: 'cb',
                        pointage: '',
                        note: 'Vente stripe',
                        invoice: invoiceNumber
                    }, {
                        payer: 'Stripe',
                        date: date,
                        receiver: 'Stripe',
                        post: 'commissions',
                        amount: `${fee} €`,
                        nature: 'prv',
                        pointage: '',
                        note: 'commission stripe',
                        invoice: invoiceNumber
                    }, {
                        payer: 'Stripe',
                        date: date,
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

        await generateCSV(fileName, records);
    } catch (error) {
        console.error('Error fetching payments or generating CSV:', error);
    }
};

// Read start and end dates from command line arguments
const startDateString = process.argv[2];
const endDateString = process.argv[3];
const startDate = dateToUnixTimestamp(startDateString);
const endDate = dateToUnixTimestamp(endDateString);

if (!startDate || !endDate) {
    console.error('Please provide start and end dates in the format YYYY-MM-DD');
    process.exit(1);
}

fetchPaymentsAndGenerateCSV(startDate, endDate, startDateString, endDateString);