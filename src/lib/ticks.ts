import { TickData } from "./open-api-schema";

const tickData = new Map<string, [number, number]>();

export const getTicks = () => {
    const ticks = Array.from(tickData.entries()).map(
        ([ticker, [mark, timestamp]]) => ({
            ticker,
            mark,
            timestamp: new Date(timestamp), // Convert number to Date object
        })
    );
    return ticks;
}

export const setTick = (data: TickData) => {
    tickData.set(data.ticker, [data.mark, data.timestamp.getTime()]);
}