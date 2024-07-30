const dateToUnixTimestamp = dateString => Math.floor(new Date(dateString).getTime() / 1000);

const formatDate = timestamp => {
    const date = new Date(timestamp * 1000);
    return date.toISOString().split('T')[0].replace(/-/g, '');
};

module.exports = {
    dateToUnixTimestamp,
    formatDate
};