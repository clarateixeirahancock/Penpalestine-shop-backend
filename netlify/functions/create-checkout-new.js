import Stripe from "stripe";

const PRODUCTS = {
  poster_a2: { name: "Poster A2", price: 2500, weight: 0.4 },
};

export async function handler(event, context, callback) {
  const headers = {
    "Access-Control-Allow-Origin": "https://my.readymag.com",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    callback(null, { statusCode: 200, headers, body: "" });
    return;
  }

  try {
    console.log("Stripe key exists:", !!process.env.STRIPE_SECRET_KEY);

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        "Stripe secret key not found. Check your Netlify environment variable."
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const body = JSON.parse(event.body || "{}");
    const { items, country } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      callback(null, { statusCode: 400, headers, body: JSON.stringify({ error: "No items sent" }) });
      return;
    }

    const lineItems = items.map((item) => {
      const product = PRODUCTS[item.id];
      if (!product) throw new Error(`Unknown product ID: ${item.id}`);
      return {
        price_data: {
          currency: "usd",
          product_data: { name: product.name },
          unit_amount: product.price,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: "https://yourreadymagsite.com/success",
      cancel_url: "https://yourreadymagsite.com/cancel",
    });

    callback(null, { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) });
  } catch (err) {
    console.error(err);
    callback(null, { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) });
  }
}

