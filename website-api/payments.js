const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authMiddleware } = require('./middleware.js');
const { getUserById } = require('../database/users.js');
const {
  createStripeCustomer,
  getStripeCustomer,
  createSubscription,
  updateSubscription,
  addPaymentMethod,
  recordInvoice
} = require('../database/stripe.js');

// Create a payment intent for initial setup
router.post('/create-setup-intent', authMiddleware, async (req, res) => {
  try {
    let customer = await getStripeCustomer(req.userId);
    
    if (!customer) {
      const user = await getUserById(req.userId);
      const stripeCustomer = await createStripeCustomer(req.userId, user.email);
      customer = { stripe_customer_id: stripeCustomer.id };
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.stripe_customer_id,
      payment_method_types: ['card'],
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
});

// Create a subscription
router.post('/create-subscription', authMiddleware, async (req, res) => {
  try {
    const { planId, paymentMethodId } = req.body;
    
    let customer = await getStripeCustomer(req.userId);
    if (!customer) {
      return res.status(400).json({ error: 'Customer not found' });
    }

    // Add the payment method to the customer if it's new
    await addPaymentMethod(customer.stripe_customer_id, paymentMethodId, true);

    // Create the subscription
    const subscription = await createSubscription(
      customer.stripe_customer_id,
      planId,
      paymentMethodId
    );

    res.json({ subscription });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Stripe webhook handler
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Webhook event handlers
async function handleInvoicePaid(invoice) {
  await recordInvoice(invoice);
  // Additional logic for successful payment
}

async function handleInvoicePaymentFailed(invoice) {
  await recordInvoice(invoice);
  // Notify user of failed payment
}

async function handleSubscriptionUpdated(subscription) {
  await updateSubscription(subscription.id, subscription.status);
}

async function handleSubscriptionDeleted(subscription) {
  await updateSubscription(subscription.id, 'canceled');
}

module.exports = router; 