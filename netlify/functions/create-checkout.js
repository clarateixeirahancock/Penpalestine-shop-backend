console.log("Stripe key exists:", !!process.env.STRIPE_SECRET_KEY);

// Redeploy to pick up Stripe key
import Stripe from "stripe";

// Example products — replace/add your actual products later
const PRODUCTS = {
  poster_a2: { name: "Poster A2", price: 2500, weight: 0.4 },
  poster_a1: { name: "Poster A1", price: 4000, weight: 0.8 },
  mug_classic: { name: "Classic Mug", price: 1500, weight: 0.5 }
};

// Example shipping zones — adjust if needed
const SHIPPING_ZONES = {
  US: { base: 500, perKg: 300 },
  EU: { base: 700, perKg: 400 },
  ROW: { base: 1000, perKg: 600 }
};

export async function handler(event, context, callback) {
  // CORS headers — allow requests from Readymag
  const headers = {
    "Access-Control-Allow-Origin": "https://my.readymag.com",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    callback(null, { statusCode: 200, headers, body: "" });
    return;
  }

  try {
    // Check if Stripe key exists
    console.log("Stripe key exists:", !!process.env.STRIPE_SECRET_KEY);

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe secret key not found. Check your Netlify environment variable.");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const { items, country } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      callback(null, { statusCode: 400, headers, body: JSON.stringify({ error: "No items sent" }) });
      return;
    }

    // Build line items and calculate shipping
    let totalWeight = 0;
    const lineItems = [];

    for (const item of items) {
      const product = PRODUCTS[item.id];
      if (!product) {
        callback(null, { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown product ID: ${item.id}` }) });
        return;
      }
      totalWeight += product.weight * item.quantity;
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: product.name },
          unit_amount: product.price
        },
        quantity: item.quantity
      });
    }

    const zone = SHIPPING_ZONES[country] ? country : "ROW";
    const shippingCost = SHIPPING_ZONES[zone].base + totalWeight * SHIPPING_ZONES[zone].perKg;

    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Shipping" },
        unit_amount: Math.round(shippingCost)
      },
      quantity: 1
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: "https://yourreadymagsite.com/success",
      cancel_url: "https://yourreadymagsite.com/cancel"
    });

    callback(null, { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) });

  } catch (err) {
    console.error(err);
    callback(null, { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) });
  }
}



