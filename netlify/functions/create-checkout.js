import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const SHIPPING_ZONES = {
  US: { base: 500, perKg: 300 },
  EU: { base: 700, perKg: 400 },
  ROW: { base: 1000, perKg: 600 }
}

const PRODUCTS = {
  poster_a2: { name: "Poster A2", price: 2500, weight: 0.4 }
}

export async function handler(event) {
  try {
    const { items, country } = JSON.parse(event.body)

    const zone = SHIPPING_ZONES[country] ? country : "ROW"

    let totalWeight = 0
    let lineItems = []

    for (const item of items) {
      const product = PRODUCTS[item.id]
      if (!product) continue

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

    const shippingCost =
      SHIPPING_ZONES[zone].base +
      totalWeight * SHIPPING_ZONES[zone].perKg

    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Shipping" },
        unit_amount: Math.round(shippingCost)
      },
      quantity: 1
    })

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: "https://yoursite.com/success",
      cancel_url: "https://yoursite.com/cancel"
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: err.message
    }
  }
}
