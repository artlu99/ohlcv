import {
  customType,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const timestamp = customType<{
  data: Date;
  driverData: string;
}>({
  dataType() {
    return "datetime";
  },
  fromDriver(value: string): Date {
    return new Date(Number(value) * 1000);
  },
  toDriver(value: Date): string {
    return String(Math.floor(value.getTime() / 1000));
  },
});

// chart_data
export const chart_data = sqliteTable("chart_data", {
  ticker: text("ticker").notNull(),
  dt_string: text("dt_string").notNull(),
  open_trade: real("open_trade").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  unadj_close: real("unadj_close").notNull(),
  volume: integer("volume").notNull(),
  adj_close: real("adj_close").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  source: text("source").notNull().$type<"yahoo" | "massive">(),
}, (table) => [
  primaryKey({ columns: [table.ticker, table.dt_string] }),
]);
