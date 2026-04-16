export function computeUtcRangeForLocalDay(dateQuery: string, timezoneOffset: number) {
    const startOfLocalDay = new Date(`${dateQuery}T00:00:00Z`);
    const endOfLocalDay = new Date(`${dateQuery}T23:59:59Z`);
    
    // Shift to UTC by adding the offset (in minutes)
    const startUtc = new Date(startOfLocalDay.getTime() + (timezoneOffset * 60 * 1000)).toISOString();
    const endUtc = new Date(endOfLocalDay.getTime() + (timezoneOffset * 60 * 1000)).toISOString();

    return { startUtc, endUtc };
}
