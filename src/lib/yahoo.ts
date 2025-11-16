import { fetcher } from "itty-fetcher";
import invariant from "tiny-invariant";
import { ApiCache } from "./cache";
import { eodTimestamp } from "./helpers";
import { ChartData, TickData } from "./open-api-schema";
import { setTick } from "./ticks";

const yahooApi = fetcher({
  base: "https://query1.finance.yahoo.com/v8/finance/chart",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});

// partial shape of Yahoo Finance API response
export interface YahooFinanceResponse {
  chart: {
    result: Array<{
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open?: number[] | null;
          high?: number[] | null;
          low?: number[] | null;
          close: number[];
          volume: number[] | null;
        }>;
        adjclose: Array<{ adjclose: number[] }>;
      };
      meta: {
        currency: string;
        symbol: string;
        longName: string;
        shortName: string;
        instrumentType: string;
        regularMarketPrice: number;
        regularMarketTime: number;
        chartPreviousClose: number;
        priceHint: number;
      };
    }>;
    error: { code: string; description: string } | null;
  };
}

// yahoo to general format
const y2g = (symbol: string) => symbol.replace("-", ".");
// general format to yahoo
const g2y = (symbol: string) => symbol.replace(".", "-");

// Cache instance: historical data never expires, errors cached for 5 minutes
export const yahooCache = new ApiCache<YahooFinanceResponse>({
  successTTL: 0, // Never expire (historical data doesn't change)
  errorTTL: 5 * 60, // 5 minutes for errors
  maxKeys: 10000,
  maxErrorKeys: 1000,
  isCacheableError: (error) => {
    // Don't cache validation errors - they indicate data problems
    if (error.message.includes("Invalid response")) {
      return false;
    }
    // Cache network errors, API errors, rate limits, etc.
    return true;
  },
});

export const getYahooData = async (
  symbol: string,
  start_date: string,
  end_date: string,
  range?: "1d" | "5d" | "5y" | undefined
): Promise<YahooFinanceResponse> => {
  const cacheKey = `${symbol}:${start_date}:${end_date}`;

  const period1 = new Date(start_date).getTime() / 1000;
  const period2 = eodTimestamp(new Date(end_date));

  return yahooCache.getOrFetch(cacheKey, async () => {
    console.log(
      `Fetching ${symbol} from Yahoo Finance API: ${
        range ? range : `${start_date} ~ ${end_date}`
      }`
    );

    const queryString =
      "interval=1d&" +
      (range ? `range=${range}` : `period1=${period1}&period2=${period2}`);
    try {
      return await yahooApi.get<YahooFinanceResponse>(
        `/${g2y(symbol)}?${queryString}`
      );
    } catch (error: unknown) {
      const err = error as {
        status: number;
        chart: {
          result: null;
          error: {
            code: string;
            description: string;
          };
        };
      };
      const errorToThrow = new Error(
        `${err.status}: ${err.chart.error.description}`
      );
      errorToThrow.name = "YahooFinanceError";
      errorToThrow.cause = err.chart.error.description;
      throw errorToThrow;
    }
  });
};

export const processRawYahooResponse = (
  res: YahooFinanceResponse
): ChartData[] => {
  invariant(res, "No data");

  const ticker = y2g(res.chart.result[0].meta.symbol);
  invariant(ticker, "Ticker is required");

  const rnd = (n: number | undefined) => Number(n?.toFixed(4));
  const dt_string = (t: number) =>
    new Date(t * 1000).toLocaleDateString("en-CA");

  const live: TickData = {
    mark: rnd(res.chart.result[0].meta.regularMarketPrice),
    timestamp: new Date(res.chart.result[0].meta.regularMarketTime * 1000),
    ticker,
  };
  setTick(live);

  const ret = (res.chart.result[0].timestamp ?? [])
    .map((t, index) => ({
      ticker,
      unadj_close: rnd(res.chart.result[0].indicators.quote[0].close[index]),
      adj_close: rnd(
        res.chart.result[0].indicators.adjclose[0].adjclose[index]
      ),
      open_trade: rnd(res.chart.result[0].indicators.quote[0].open?.[index]),
      high: rnd(res.chart.result[0].indicators.quote[0].high?.[index]),
      low: rnd(res.chart.result[0].indicators.quote[0].low?.[index]),
      volume: res.chart.result[0].indicators.quote[0].volume?.[index] ?? 0,
      timestamp: new Date(t * 1000),
      dt_string: dt_string(t),
    }))
    .filter((c) => !!c.unadj_close);
  return ret;
};
