import { Static, t } from "elysia";

// OpenAPI schemas
export const TickDataSchema = t.Object({
  timestamp: t.Date({ description: "ISO8601 timestamp" }),
  ticker: t.String({ description: "Ticker symbol" }),
  mark: t.Number({ description: "Adjusted close price" }),
  source: t.Union([t.Literal("yahoo"), t.Literal("ninja")], { description: "Tick data source" }),
});
export type TickData = Static<typeof TickDataSchema>;

export const ChartDataSchema = t.Object({
  ticker: t.String({ description: "Ticker symbol" }),
  dt_string: t.String({ description: "YYYY-MM-DD date string" }),
  open_trade: t.Number({ description: "Opening trade price" }),
  high: t.Number({ description: "Highest price" }),
  low: t.Number({ description: "Lowest price" }),
  unadj_close: t.Number({ description: "Close price (unadjusted)" }),
  volume: t.Integer({ description: "Volume" }),
  adj_close: t.Number({ description: "Adjusted close price" }),
  timestamp: t.Date({ description: "ISO8601 timestamp" }),
  source: t.Union([t.Literal("yahoo"), t.Literal("massive"), t.Literal("ninja")], { description: "Chart data source" }),
});
export type ChartData = Static<typeof ChartDataSchema>;
