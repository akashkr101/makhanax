export function validateOrderItems(items, catalog) {
    const messages = [];
    const itemTotals = [];
    let subtotal = 0;
    if (!items || items.length === 0) {
        return { valid: false, subtotal: 0, messages: ['Cart is empty.'], itemTotals: [] };
    }
    for (const item of items) {
        if (!item || item.quantity <= 0) {
            messages.push(`Invalid quantity for ${item?.name ?? 'an item'}.`);
            continue;
        }
        const product = catalog.find((candidate) => {
            if (item.productId)
                return candidate.id === item.productId;
            return candidate.name === item.name && candidate.size === item.size;
        });
        if (!product) {
            messages.push(`${item.name} (${item.size}) is not available in the catalog.`);
            continue;
        }
        const stockAvailable = product.stock ?? 0;
        if (item.quantity > stockAvailable) {
            messages.push(`${product.name} (${product.size}) only has ${stockAvailable} unit(s) left in stock.`);
            continue;
        }
        const total = product.price * item.quantity;
        subtotal += total;
        itemTotals.push({
            productId: item.productId ?? product.id,
            name: product.name,
            size: product.size,
            quantity: item.quantity,
            unitPrice: product.price,
            total
        });
    }
    return {
        valid: messages.length === 0 && itemTotals.length > 0,
        subtotal,
        messages,
        itemTotals
    };
}
