const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');

const createDirectoryIfNotExists = dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
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

module.exports = {
    createDirectoryIfNotExists,
    generateCSV
};