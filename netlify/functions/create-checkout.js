import Stripe from "stripe"

const PRODUCTS = {
  poster_a2: { name: "Poster A2", price: 2500, weight: 0.4 },
  poster_a1: { name: "Poster A1", price: 4000, weight: 0.8 },
  mug_classic: { name: "Classic Mug", price: 1500, weight: 0.5 }
}

const SHIPPING_ZONES = {
  US: { base: 500, perKg: 300 },
  EU: { base: 700, perKg: 400 },
  ROW: { base: 1000, perKg: 600 }
}

export async function handler(event, context, callback) {

  // ===== CORS HEADERS =====
  const headers = {
    "Access-Control-Allow-Origin": "https://my.readymag.com", // your Readymag URL
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  }

  // ===== PRE-FLIGHT =====
  if (event.httpMethod === "OPTIONS") {
    callback(null, {
      statusCode: 200,
      headers,
      body: ""
    })
    return
  }

  try {
    const body = JSON.parse(event.body || "{}")
    const { items, country } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      callback(null, {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No items sent" })
      })
      return
    }

    let totalWeight = 0
    let lineItems = []

    for (const item of items) {
      const product = PRODUCTS[item.id]
      if (!product) {
        callback(null, {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown product ID: ${item.id}` })
        })
        return
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

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: "https://yourreadymagsite.com/success",
      cancel_url: "https://yourreadymagsite.com/cancel"
    })

    callback(null, {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url })
    })

  } catch (err) {
    callback(null, {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    })
  }
}


