function formatExactTime(ms) {
    if (ms <= 0) return '`0s`';
    
    const years = Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25));
    const months = Math.floor((ms % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
    const days = Math.floor((ms % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    const parts = [];
    if (years > 0) parts.push(`\`${years}y\``);
    if (months > 0) parts.push(`\`${months}m\``);
    if (days > 0) parts.push(`\`${days}d\``);
    if (hours > 0) parts.push(`\`${hours}h\``);
    if (minutes > 0) parts.push(`\`${minutes}m\``);
    if (seconds > 0) parts.push(`\`${seconds}s\``);
    
    return parts.length > 0 ? parts.join(', ') : '`0s`';
}

function getDaysSince(date) {
    const msSince = Date.now() - new Date(date).getTime();
    return Math.floor(msSince / (1000 * 60 * 60 * 24));
}

function getMsSince(date) {
    return Date.now() - new Date(date).getTime();
}

module.exports = {
    formatExactTime,
    getDaysSince,
    getMsSince
};
