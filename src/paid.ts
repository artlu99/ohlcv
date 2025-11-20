import { Hono } from "hono";
import invariant from "tiny-invariant";
// import { Resource, paymentMiddleware } from "x402-hono";

const honoApp = new Hono();

const payTo = process.env.ADDRESS as `0x${string}`;
// const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
invariant(process.env.ADDRESS, "ADDRESS is required");
// invariant(facilitatorUrl, "FACILITATOR_URL is required");

honoApp
  // .use(
  //   paymentMiddleware(
  //     payTo,
  //     {
  //       "/": {
  //         price: "$0.001",
  //         network: "base",
  //       },
  //     },
  //     {
  //       url: facilitatorUrl,
  //     }
  //   )
  // )
  .get("/", (c) => c.text(`Hello, thank you for paying ${payTo}!`));

// Export the Hono app as a handler
export { honoApp };
