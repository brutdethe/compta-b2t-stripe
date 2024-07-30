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

module.exports = determinePostType;