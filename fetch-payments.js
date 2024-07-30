const stripe = require('stripe');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const process = require('process');

// Load environment variables from .env.json
const env = JSON.parse(fs.readFileSync('.env.json', 'utf8'));
const stripeClient = stripe(env.STRIPE_PRIVATE);

/**
 * Converts a date string in the format "YYYY-MM-DD" to a Unix timestamp.
 * @param {string} dateString - The date string to convert.
 * @returns {number} The Unix timestamp.
 */
function dateToUnixTimestamp(dateString) {
    return Math.floor(new Date(dateString).getTime() / 1000);
}

/**
 * Ensures that the directory exists. If it does not, it creates it.
 * @param {string} dir - The directory path.
 */
function ensureDirectoryExistence(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Converts a Unix timestamp to a date string in the format "YYYYMMDD".
 * @param {number} timestamp - The Unix timestamp to convert.
 * @returns {string} The formatted date string.
 */
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

/**
 * Determines the post type based on the items description.
 * @param {string} items - The concatenated item descriptions.
 * @returns {string} The post type.
 */
function determinePostType(items) {
    items = items.toLowerCase();
    if (items.includes('formation') || items.includes('cérémonie')) {
        return 'prestations de services';
    } else if (items.includes('billet') || items.includes('cotisation') || items.includes('adhésion')) {
        return 'cotisations';
    } else if (items.includes('don')) {
        return 'dons manuels';
    } else {
        return 'ventes de marchandises';
    }
}

/**
 * Retrieves items descriptions from invoices or checkout sessions.
 * @param {object} payment - The payment object.
 * @returns {string} The concatenated item descriptions.
 */
async function getItemsDescription(payment) {
    let items = '';

    if (payment.invoice) {
        const invoiceItems = await stripeClient.invoiceItems.list({
            invoice: payment.invoice
        });
        items = invoiceItems.data.map(item => item.description).join(', ');
    }

    if (payment.payment_intent) {
        const sessionList = await stripeClient.checkout.sessions.list({
            payment_intent: payment.payment_intent,
        });

        if (sessionList.data.length > 0) {
            const session = sessionList.data[0];
            const lineItems = await stripeClient.checkout.sessions.listLineItems(session.id);
            items = lineItems.data.map(item => item.description).join(', ');
        }
    }

    return items;
}

/**
 * Fetches all payments from Stripe within a specified date range and generates a CSV file with accounting entries.
 * @param {number} startDate - The start date as a Unix timestamp.
 * @param {number} endDate - The end date as a Unix timestamp.
 * @param {string} startDateString - The start date as a string.
 * @param {string} endDateString - The end date as a string.
 */
async function fetchPaymentsAndGenerateCSV(startDate, endDate, startDateString, endDateString) {
    try {
        const directory = 'generated_reports';
        ensureDirectoryExistence(directory);

        const fileName = `${directory}/ecritures_comptables_${startDateString}_to_${endDateString}.csv`;
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
                { id: 'invoice', title: 'facture correspondante' },
            ]
        });

        let hasMore = true;
        let startingAfter = null;
        const records = [];

        while (hasMore) {
            const params = {
                limit: 100,
                created: {
                    gte: startDate,
                    lte: endDate,
                },
                ...(startingAfter && { starting_after: startingAfter }),
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

                    let invoiceNumber = `${formattedDate}_`;
                    if (payment.invoice) {
                        const invoice = await stripeClient.invoices.retrieve(payment.invoice);
                        invoiceNumber += invoice.number || '';
                    }

                    records.push({
                        payer: 'Membre',
                        date: date, // Using ISO format for sorting
                        receiver: 'Stripe',
                        post: postType,
                        amount: `${amount} €`,
                        nature: 'cb',
                        pointage: '',
                        note: 'Vente stripe',
                        invoice: invoiceNumber,
                    }, {
                        payer: 'Stripe',
                        date: date, // Using ISO format for sorting
                        receiver: 'Stripe',
                        post: 'commissions',
                        amount: `${fee} €`,
                        nature: 'prv',
                        pointage: '',
                        note: 'commission stripe',
                        invoice: invoiceNumber,
                    }, {
                        payer: 'Stripe',
                        date: date, // Using ISO format for sorting
                        receiver: 'B2T',
                        post: 'caisse stripe',
                        amount: `${netAmount} €`,
                        nature: 'cb',
                        pointage: 'x',
                        note: 'transfert stripe',
                        invoice: invoiceNumber,
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
        console.log(`CSV file ${fileName} created successfully.`);
    } catch (error) {
        console.error('Error fetching payments or generating CSV:', error);
    }
}

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