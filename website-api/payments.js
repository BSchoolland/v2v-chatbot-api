const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authMiddleware } = require('./middleware.js');
const { getUserById } = require('../database/users.js');
const { dbRun, dbGet } = require('../database/database.js');
const {
  createStripeCustomer,
  getStripeCustomer,
  createSubscription,
  updateSubscription,
  addPaymentMethod,
  recordInvoice
} = require('../database/stripe.js');
const {
  allocateMonthlyCredits,
  resetToFreeCredits,
  checkAndRenewCredits
} = require('../database/credits.js');
const { cancelActiveSubscriptions } = require('../database/plans.js');

// Get Stripe publishable key
router.get('/config', async (req, res) => {
  res.json({
    success: true,
    publishableKey: process.env.STRIPE_PUBLIC_KEY
  });
});

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

    res.json({ success: true, clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ success: false, message: 'Failed to create setup intent' });
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

    // Cancel any existing active subscriptions for this plan
    await cancelActiveSubscriptions(planId);

    // Add the payment method to the customer if it's new
    await addPaymentMethod(customer.stripe_customer_id, paymentMethodId, true);

    // Create subscription with the payment method
    const subscription = await createSubscription(
      customer.stripe_customer_id,
      planId,
      paymentMethodId
    );

    // Get the plan type to determine credit amount
    const plan = await dbGet(
      `SELECT p.*, pt.plan_type_id 
       FROM plans p
       JOIN plan_type pt ON p.plan_type_id = pt.plan_type_id
       WHERE p.plan_id = ?`,
      [planId]
    );

    // Set subscription active and allocate full credits for the plan type
    await dbRun(
      `UPDATE plans 
       SET subscription_active = 1
       WHERE plan_id = ?`,
      [planId]
    );

    // Allocate monthly credits (this will give full plan credits)
    await allocateMonthlyCredits(planId);

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to create subscription' });
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

// Cancel subscription
router.post('/cancel-subscription', authMiddleware, async (req, res) => {
  try {
    console.log('Cancel subscription request received');
    console.log('Request body:', req.body);
    console.log('User ID from auth:', req.userId);
    
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }

    // First check if the customer exists
    const customer = await dbGet(
      'SELECT * FROM stripe_customers WHERE user_id = ?',
      [req.userId]
    );
    console.log('Found customer:', customer);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    // Get the subscription from our database with a simpler query first
    const subscription = await dbGet(
      `SELECT ss.* FROM stripe_subscriptions ss
       WHERE ss.customer_id = ? AND ss.plan_id = ? AND ss.status = 'active'`,
      [customer.stripe_customer_id, planId]
    );
    console.log('Found subscription:', subscription);

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Active subscription not found' });
    }

    // Cancel the subscription in Stripe
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

    // Update subscription status in our database
    await dbRun(
      `UPDATE stripe_subscriptions 
       SET status = 'canceled', updated_at = CURRENT_TIMESTAMP 
       WHERE stripe_subscription_id = ?`,
      [subscription.stripe_subscription_id]
    );

    // Update plan type to free (0) and mark as inactive
    await dbRun(
      `UPDATE plans 
       SET plan_type_id = 0, subscription_active = 0 
       WHERE plan_id = ?`,
      [planId]
    );

    // Reset to free plan credits
    await resetToFreeCredits(planId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    console.error('Error details:', {
      userId: req.userId,
      planId: req.body.planId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
  }
});

// Change subscription (handles both upgrades and downgrades)
router.post('/upgrade-subscription', authMiddleware, async (req, res) => {
  try {
    const { planId } = req.body;
    
    let customer = await getStripeCustomer(req.userId);
    if (!customer) {
      return res.status(400).json({ error: 'Customer not found' });
    }

    // Get the current active payment method
    const paymentMethod = await dbGet(
      `SELECT stripe_payment_method_id 
       FROM stripe_payment_methods 
       WHERE customer_id = ? AND is_default = 1`,
      [customer.stripe_customer_id]
    );

    if (!paymentMethod) {
      return res.status(400).json({ error: 'No payment method found' });
    }

    // Get current subscription to ensure it's a valid change
    const currentPlan = await dbGet(
      `SELECT p.*, pt.plan_type_id, pt.cost_monthly
       FROM plans p
       JOIN plan_type pt ON p.plan_type_id = pt.plan_type_id
       WHERE p.plan_id = ?`,
      [planId]
    );

    if (!currentPlan) {
      return res.status(400).json({ error: 'Plan not found' });
    }

    // Create new subscription (this will handle canceling the old one)
    const subscription = await createSubscription(
      customer.stripe_customer_id,
      planId,
      paymentMethod.stripe_payment_method_id
    );

    if (subscription.status === 'active') {
      // Set subscription active and allocate full credits for the plan type
      await dbRun(
        `UPDATE plans 
         SET subscription_active = 1
         WHERE plan_id = ?`,
        [planId]
      );

      // Allocate monthly credits (this will give full plan credits)
      await allocateMonthlyCredits(planId);
    }

    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error changing subscription:', error);
    res.status(500).json({ success: false, message: 'Failed to change subscription' });
  }
});

module.exports = router; 