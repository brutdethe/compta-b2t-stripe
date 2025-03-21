const { createDirectoryIfNotExists, generateCSV } = require('./utils/file');
const { dateToUnixTimestamp, formatDate } = require('./utils/date');
const determinePostType = require('./utils/postType');
const { getItemsDescription, fetchPayments, fetchBalanceTransaction, fetchInvoice } = require('./utils/stripe');

const formatAmount = amount => {
    return (amount / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
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
                created: { gte: startDate, lte: endDate }
            };

            const payments = await fetchPayments(params, startingAfter);

            for (const payment of payments.data) {
                if (payment.paid && payment.status === 'succeeded') {
                    const balanceTransaction = await fetchBalanceTransaction(payment.balance_transaction);
                    const date = new Date(payment.created * 1000).toISOString().split('T')[0];
                    const formattedDate = formatDate(payment.created);
                    const amount = formatAmount(balanceTransaction.amount);
                    const fee = formatAmount(balanceTransaction.fee);
                    const netAmount = formatAmount(balanceTransaction.net);
                    const items = await getItemsDescription(payment);
                    const postType = determinePostType(items);

                    let invoiceNumber = '';
                    if (payment.invoice) {
                        const invoice = await fetchInvoice(payment.invoice);
                        invoiceNumber = `${formattedDate}_${invoice.number || ''}`;
                    }

                    records.push({
                        payer: 'Membre',
                        date: date,
                        receiver: 'Stripe',
                        post: postType,
                        amount: amount,
                        nature: 'cb',
                        pointage: '',
                        note: 'Vente stripe',
                        invoice: invoiceNumber
                    }, {
                        payer: 'Stripe',
                        date: date,
                        receiver: 'Stripe',
                        post: 'commissions',
                        amount: fee,
                        nature: 'prv',
                        pointage: '',
                        note: 'commission stripe',
                        invoice: invoiceNumber
                    }, {
                        payer: 'Stripe',
                        date: date,
                        receiver: 'Association',
                        post: 'caisse stripe',
                        amount: netAmount,
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