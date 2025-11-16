# ohlcv api

This is a simple API that provides ohlcv and live tick data.

The database holds immutable historical candle data. It is self-completing and sparse; that is, it does not know which tickers to care about, but once a user requests a symbol, it updates itself and then keeps itself updated.

Live data lives in memory only; that is, it does not persist through restarts. It also updates upon user request.

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

## /uses

- Bun v1.3.2 server
- Elysia with OpenAPI
- bun:sqlite
- node-cache as an in-memory cache
    - TTL
    - memory use limits
    - stampede protection
    - error caching
- TypeBox validation (incomplete)
- light use of Drizzle ORM
    - type completion
    - manual migrations
- TailwindCss + DaisyUI components