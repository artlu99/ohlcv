import { Database } from "bun:sqlite";
import { isBefore, isSameDay, isValid } from "date-fns";
import { and, count, eq, gte, lte, max, min } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { sort } from "radash";
import invariant from "tiny-invariant";
import { chart_data } from "./db-schema";
import { ChartData } from "./open-api-schema";

// Database connection
const sqlite = new Database("./db/ohlcv.db3", { strict: true });
const db = drizzle({ client: sqlite });

// sync API, not async
export const getDatabaseStatus = () => {
  const result = db
    .select({
      ticker: chart_data.ticker,
      n: count(chart_data.ticker),
      last: max(chart_data.timestamp),
    })
    .from(chart_data)
    .groupBy(chart_data.ticker)
    .all();
  return {
    n: result.length,
    most_stale_5: sort(result, (r) => r.last?.getTime() ?? 0, false).slice(
      0,
      5
    ),
  };
};

// sync API, not async
export const getChartData = (
  ticker: string,
  start_date: string,
  end_date: string
) => {
  invariant(ticker, "ticker is required");
  invariant(start_date, "start_date is required");
  invariant(end_date, "end_date is required");

  // validate start_date and end_date
  invariant(
    isValid(new Date(start_date)),
    `start_date is invalid: ${start_date}, must be in YYYY-MM-DD format`
  );
  invariant(
    isValid(new Date(end_date)),
    `end_date is invalid: ${end_date}, must be in YYYY-MM-DD format`
  );

  // validate start_date is before end_date
  invariant(
    isBefore(new Date(start_date), new Date(end_date)) ||
      isSameDay(new Date(start_date), new Date(end_date)),
    `start_date must be before end_date: ${start_date} is after ${end_date}`
  );

  // sanity checks on ticker string
  invariant(ticker.length > 0, "ticker is required");
  invariant(ticker.length <= 9, "ticker must be less than 9 characters");
  invariant(ticker.match(/[A-Z-]+$/), "ticker must be all uppercase letters"); // except the first character which may be a ^

  const result = db
    .select({
      ticker: chart_data.ticker,
      dt_string: chart_data.dt_string,
      open_trade: chart_data.open_trade,
      high: chart_data.high,
      low: chart_data.low,
      unadj_close: chart_data.unadj_close,
      volume: chart_data.volume,
      adj_close: chart_data.adj_close,
      timestamp: chart_data.timestamp,
    })
    .from(chart_data)
    .where(
      and(
        eq(chart_data.ticker, ticker),
        gte(chart_data.dt_string, start_date),
        lte(chart_data.dt_string, end_date)
      )
    )
    .orderBy(chart_data.timestamp)
    .all();
  return result;
};

// async API
export const upsertChartData = async (data: ChartData[]) => {
  try {
    const start = performance.now();

    // Bulk insert is more efficient than individual inserts
    if (data.length > 0) {
      db.insert(chart_data).values(data).onConflictDoNothing().run();
    }

    const end = performance.now();
    const duration = end - start;
    console.log(
      `Inserted ${data.length} rows in ${duration.toFixed(2)}ms (${(
        duration / data.length
      ).toFixed(2)}ms per row)`
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
};
