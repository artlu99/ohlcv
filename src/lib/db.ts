import { Database } from "bun:sqlite";
import { isBefore, isSameDay, isValid } from "date-fns";
import { and, count, eq, gte, lte, max, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { sort } from "radash";
import invariant from "tiny-invariant";
import { chart_data } from "./db-schema";
import { ChartData } from "./open-api-schema";

interface UpsertResult {
  changes: number;
  lastInsertRowid: number;
}

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
export const getKnownTickers = (): string[] => {
  const result = db
    .select({
      ticker: chart_data.ticker,
    })
    .from(chart_data)
    .groupBy(chart_data.ticker)
    .all();
  return result.map((r) => r.ticker);
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
      source: chart_data.source,
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

// Track in-flight upsert operations to prevent duplicate work
const inFlightUpserts = new Map<string, Promise<void>>();

/**
 * Generate idempotency key from chart data
 * Same ticker + date range = same key (idempotent)
 */
const getIdempotencyKey = (data: ChartData[]): string => {
  if (data.length === 0) {
    return "empty";
  }
  // Use ticker + first date + last date as idempotency key
  // Sort by dt_string to get date range
  const sorted = [...data].sort((a, b) =>
    a.dt_string.localeCompare(b.dt_string)
  );
  const ticker = sorted[0].ticker;
  const firstDate = sorted[0].dt_string;
  const lastDate = sorted[sorted.length - 1].dt_string;
  return `${ticker}:${firstDate}:${lastDate}`;
};

// async API with idempotency protection
export const upsertChartData = async (data: ChartData[]): Promise<void> => {
  if (data.length === 0) {
    return;
  }

  const idempotencyKey = getIdempotencyKey(data);

  // Check if there's already an in-flight upsert for this data
  const inFlight = inFlightUpserts.get(idempotencyKey);
  if (inFlight) {
    console.log(
      `Deduplicating upsert for ${idempotencyKey} (${data.length} rows)`
    );
    return inFlight;
  }

  // Create new upsert operation
  const upsertPromise = (async () => {
    try {
      const start = performance.now();

      // Bulk insert is more efficient than individual inserts
      // Only update when data actually differs (atomic operation)
      const result = (await db
        .insert(chart_data)
        .values(data)
        .onConflictDoUpdate({
          target: [chart_data.ticker, chart_data.dt_string],
          set: {
            open_trade: sql`excluded.open_trade`,
            high: sql`excluded.high`,
            low: sql`excluded.low`,
            unadj_close: sql`excluded.unadj_close`,
            volume: sql`excluded.volume`,
            adj_close: sql`excluded.adj_close`,
            timestamp: sql`excluded.timestamp`,
            source: sql`excluded.source`,
          },
          where: sql`chart_data.open_trade != excluded.open_trade
                OR chart_data.high != excluded.high
                OR chart_data.low != excluded.low
                OR chart_data.unadj_close != excluded.unadj_close
                OR chart_data.volume != excluded.volume
                OR chart_data.adj_close != excluded.adj_close
                OR chart_data.timestamp != excluded.timestamp
                OR chart_data.source != excluded.source`,
        })
        .execute()) as unknown as UpsertResult;

      const end = performance.now();
      const duration = end - start;
      console.log(
        `Inserted/updated ${result.changes} rows in ${duration.toFixed(
          2
        )}ms (${(duration / data.length).toFixed(2)}ms per row)`
      );
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      // Remove from in-flight tracking once done (success or failure)
      inFlightUpserts.delete(idempotencyKey);
    }
  })();

  // Track the in-flight upsert IMMEDIATELY (before await) to prevent race conditions
  inFlightUpserts.set(idempotencyKey, upsertPromise);

  return upsertPromise;
};
