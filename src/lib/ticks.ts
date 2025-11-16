import { sort } from "radash";
import invariant from "tiny-invariant";
import { ChartData, TickData } from "./open-api-schema";

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

export const injectTicks = (rawData: ChartData[]): ChartData[] => {
  invariant(rawData.length > 0, "rawData is required");

  invariant(rawData[0].ticker, "ticker is required");
  invariant(
    new Set(rawData.map((r) => r.ticker)).size === 1,
    "all tickers must be the same"
  );
  const ticker = rawData[0].ticker;

  const tick = tickData.get(ticker);
  if (!tick) return rawData;

  const sorted = sort(rawData, (r) => r.timestamp.getTime(), true);
  const tickDate = new Date(tick[1]).toLocaleDateString("en-CA");

  if (!sorted.map((r) => r.dt_string).includes(tickDate)) {
    return [
      ...rawData,
      {
        ticker,
        dt_string: tickDate,
        unadj_close: tick[0],
        adj_close: tick[0],
        open_trade: tick[0],
        high: tick[0],
        low: tick[0],
        volume: 0,
        timestamp: new Date(tick[1]),
      },
    ];
  }

  // handle the case where the tick date is in the middle of the data as the last date
  const data = rawData.map((r) => {
    if (r.dt_string !== tickDate) {
      return r;
    }

    if (tick[1] > r.timestamp.getTime()) {
      return {
        ...r,
        unadj_close: tick[0],
        adj_close: tick[0],
        timestamp: new Date(tick[1]),
      };
    }

    return r;
  });
  return data;
};
