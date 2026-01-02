import Stripe from "stripe"

// ===== CORS HEADERS =====
const headers = {
  "Access-Control-Allow-Origin": "https://my.readymag.com", // restrict to your site
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
}

// ===== PRODUCT LIST =====
const PRODUCTS = {
  poster_a2: { name: "Poster A2", price: 2500, weight: 0.4 },
  poster_a1: { name: "Poster A1", price: 4000, weight: 0.8 },
  mug_classic: { name: "Classic Mug", price: 1500, weight: 0.5 }
}

// ===== SHIPPING =====
const SHIPPING_ZONES = {
  US: { base: 500, perKg: 300 },
  EU: { base: 700, perKg: 400 },
  ROW: { base: 1000, perKg: 600 }
}

// ===== NETLIFY FUNCTION =====
export async function handler(event) {

  // ===== PRE-FLIGHT =====
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    }
  }

  try {
    // ===== PARSE BODY =====
    const body = JSON.parse(event.body || "{}")
    const { items, country } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No items sent" })
      }
    }

    // ===== CALCULATE LINE ITEMS =====
    let totalWeight = 0
    let lineItems = []

    for (const item of items) {
      const product = PRODUCTS[item.id]
      if (!product) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown product ID: ${item.id}` })
        }
      }
      totalWeight += product.weight * item.quantity

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: product.name },
          unit_amount: product.price
        },
        quantity: item.quantity
      })
    }

    // ===== SHIPPING =====
    const zone = SHIPPING_ZONES[country] ? country : "ROW"
    const shippingCost = SHIPPING_ZONES[zone].base + totalWeight * SHIPPING_ZONES[zone].perKg

    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Shipping" },
        unit_amount: Math.round(shippingCost)
      },
      quantity: 1
    })

    // ===== CREATE STRIPE SESSION =====
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: "https://yourreadymagsite.com/success",
      cancel_url: "https://yourreadymagsite.com/cancel"
    })

    // ===== RETURN =====
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url })
    }

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}

