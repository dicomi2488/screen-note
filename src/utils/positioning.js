// positioning helper utilities for popups
// Exported helpers:
// - chooseSideTowardsCenter(anchorRect): returns 'top'|'bottom'|'left'|'right' pointing towards viewport center
// - orderedSides(preferred): returns array of sides with preferred first
// - computePositionForSide(side, anchorRect, popupW, popupH, containerRect, gap=8): returns {left, top} relative to containerRect

export function chooseSideTowardsCenter(anchorRect) {
    try {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cx = vw / 2;
        const cy = vh / 2;
        const ax = anchorRect.left + anchorRect.width / 2;
        const ay = anchorRect.top + anchorRect.height / 2;
        const dx = cx - ax;
        const dy = cy - ay;
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        }
        return dy > 0 ? 'bottom' : 'top';
    } catch (e) {
        return 'bottom';
    }
}

export function orderedSides(preferred) {
    const all = ['right','left','bottom','top'];
    // create an order with preferred first, then others in a reasonable order
    const order = [preferred];
    for (const s of all) if (!order.includes(s)) order.push(s);
    return order;
}

export function computePositionForSide(side, anchorRect, popupW, popupH, containerRect, gap = 8) {
    // containerRect typically from container.getBoundingClientRect();
    // returns coordinates relative to containerRect.left/top
    const leftRelative = (x) => x - containerRect.left;
    const topRelative = (y) => y - containerRect.top;
    const ax = anchorRect.left;
    const ay = anchorRect.top;
    const ar = anchorRect.right;
    const ab = anchorRect.bottom;
    const aw = anchorRect.width;
    const ah = anchorRect.height;

    let left = 0, top = 0;
    switch(side) {
        case 'right':
            left = ar - containerRect.left + gap;
            top = topRelative(ay + (ah - popupH) / 2);
            break;
        case 'left':
            left = leftRelative(ax - popupW - gap);
            top = topRelative(ay + (ah - popupH) / 2);
            break;
        case 'bottom':
            left = leftRelative(ax + (aw - popupW) / 2);
            top = topRelative(ab + gap);
            break;
        case 'top':
            left = leftRelative(ax + (aw - popupW) / 2);
            top = topRelative(ay - popupH - gap);
            break;
        default:
            left = leftRelative(ar + gap);
            top = topRelative(ay);
    }
    return { left: Math.round(left), top: Math.round(top) };
}
