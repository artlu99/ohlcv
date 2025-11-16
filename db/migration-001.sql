CREATE TABLE IF NOT EXISTS chart_data (
    ticker TEXT NOT NULL,
    dt_string TEXT NOT NULL,
    open_trade REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    unadj_close REAL NOT NULL,
    volume INTEGER NOT NULL,
    adj_close REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    PRIMARY KEY (ticker, dt_string)
);
INSERT INTO chart_data (
        ticker,
        dt_string,
        open_trade,
        high,
        low,
        unadj_close,
        volume,
        adj_close,
        timestamp
    )
VALUES (
        'AAPL',
        '2025-11-12',
        275.08,
        275.73,
        271.87,
        273.44,
        34398678,
        273.44,
        1762981260
    )
ON CONFLICT DO NOTHING;