export const ORDER_STATUS_SEQUENCE = ['New', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
const ORDER_STATUS_RANK = {
    New: 0,
    Confirmed: 1,
    Shipped: 2,
    Delivered: 3,
    Cancelled: 4
};
export function canAdvanceOrderStatus(currentStatus, nextStatus) {
    if (currentStatus === nextStatus)
        return true;
    if (currentStatus === 'Delivered' || currentStatus === 'Cancelled')
        return false;
    if (nextStatus === 'Cancelled')
        return true;
    return ORDER_STATUS_RANK[nextStatus] > ORDER_STATUS_RANK[currentStatus] && nextStatus !== 'New';
}
export function nextOrderStatusFrom(currentStatus) {
    const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(currentStatus);
    if (currentIndex === -1 || currentStatus === 'Delivered' || currentStatus === 'Cancelled')
        return null;
    const nextIndex = currentIndex + 1;
    return nextIndex < ORDER_STATUS_SEQUENCE.length ? ORDER_STATUS_SEQUENCE[nextIndex] : null;
}
