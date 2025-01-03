const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { dbRun, dbGet, dbAll } = require('./database');

// Customer operations
async function createStripeCustomer(userId, email) {
  try {
    // Create customer in Stripe
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId: userId.toString()
      }
    });

    // Store customer in our database
    await dbRun(
      'INSERT INTO stripe_customers (user_id, stripe_customer_id) VALUES (?, ?)',
      [userId, customer.id]
    );

    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
}

async function getStripeCustomer(userId) {
  try {
    const customer = await dbGet(
      'SELECT * FROM stripe_customers WHERE user_id = ?',
      [userId]
    );
    return customer;
  } catch (error) {
    console.error('Error getting Stripe customer:', error);
    throw error;
  }
}

// Subscription operations
async function createSubscription(customerId, planId, paymentMethodId) {
  try {
    // Get the plan details from our database
    const plan = await dbGet('SELECT * FROM plans WHERE plan_id = ?', [planId]);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const planType = await dbGet('SELECT * FROM plan_type WHERE plan_type_id = ?', [plan.plan_type_id]);
    if (!planType) {
      throw new Error('Plan type not found');
    }

    // First create a product
    const product = await stripe.products.create({
      name: `${planType.name} - ${plan.name}`,
      description: planType.description || `${planType.name} Subscription`
    });

    // Then create a price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: planType.cost_monthly * 100, // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month'
      }
    });

    // Create subscription using the price
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      default_payment_method: paymentMethodId
    });

    // Store subscription in our database
    await dbRun(
      `INSERT INTO stripe_subscriptions 
       (customer_id, stripe_subscription_id, plan_id, status, 
        current_period_start, current_period_end) 
       VALUES (?, ?, ?, ?, datetime(?,'unixepoch'), datetime(?,'unixepoch'))`,
      [
        customerId,
        subscription.id,
        planId,
        subscription.status,
        subscription.current_period_start,
        subscription.current_period_end
      ]
    );

    // Update plan's subscription status to active
    await dbRun(
      `UPDATE plans SET subscription_active = 1 WHERE plan_id = ?`,
      [planId]
    );

    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}

async function updateSubscription(subscriptionId, status) {
  try {
    await dbRun(
      `UPDATE stripe_subscriptions 
       SET status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE stripe_subscription_id = ?`,
      [status, subscriptionId]
    );
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

// Payment method operations
async function addPaymentMethod(customerId, paymentMethodId, isDefault = false) {
  try {
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    await dbRun(
      `INSERT INTO stripe_payment_methods 
       (customer_id, stripe_payment_method_id, type, last4, 
        exp_month, exp_year, is_default) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        paymentMethod.id,
        paymentMethod.type,
        paymentMethod.card.last4,
        paymentMethod.card.exp_month,
        paymentMethod.card.exp_year,
        isDefault
      ]
    );

    return paymentMethod;
  } catch (error) {
    console.error('Error adding payment method:', error);
    throw error;
  }
}

// Invoice operations
async function recordInvoice(stripeInvoice) {
  try {
    const customer = await dbGet(
      'SELECT customer_id FROM stripe_customers WHERE stripe_customer_id = ?',
      [stripeInvoice.customer]
    );

    const subscription = await dbGet(
      'SELECT subscription_id FROM stripe_subscriptions WHERE stripe_subscription_id = ?',
      [stripeInvoice.subscription]
    );

    await dbRun(
      `INSERT INTO stripe_invoices 
       (customer_id, stripe_invoice_id, subscription_id, 
        amount_due, amount_paid, status, invoice_date, 
        due_date, paid_date) 
       VALUES (?, ?, ?, ?, ?, ?, datetime(?,'unixepoch'), 
        datetime(?,'unixepoch'), datetime(?,'unixepoch'))`,
      [
        customer.customer_id,
        stripeInvoice.id,
        subscription?.subscription_id,
        stripeInvoice.amount_due,
        stripeInvoice.amount_paid,
        stripeInvoice.status,
        stripeInvoice.created,
        stripeInvoice.due_date,
        stripeInvoice.status === 'paid' ? stripeInvoice.status_transitions.paid_at : null
      ]
    );
  } catch (error) {
    console.error('Error recording invoice:', error);
    throw error;
  }
}

module.exports = {
  createStripeCustomer,
  getStripeCustomer,
  createSubscription,
  updateSubscription,
  addPaymentMethod,
  recordInvoice
}; 