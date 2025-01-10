require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testPaymentFlow() {
  try {
    console.log('Starting payment flow test...');

    // 1. Create a test customer
    const customer = await stripe.customers.create({
      email: 'test@example.com',
      description: 'Test Customer for Payment Flow',
      source: 'tok_visa' // Using Stripe's test token
    });
    console.log('Created test customer:', customer.id);

    // 2. Create a test product
    let product = await stripe.products.create({
      name: 'Test Subscription',
      description: 'Test Subscription Product'
    });
    console.log('Created test product:', product.id);

    // 3. Create a price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 1000, // $10.00
      currency: 'usd',
      recurring: {
        interval: 'month'
      }
    });
    console.log('Created test price:', price.id);

    // 4. Create a subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      }
    });
    console.log('Created test subscription:', subscription.id);

    console.log('\nTest completed successfully!');
    console.log('You should now see a test payment in your Stripe dashboard.');
    console.log('Customer ID:', customer.id);
    console.log('Subscription ID:', subscription.id);
  } catch (error) {
    console.error('Error in payment flow test:', error);
  }
}

testPaymentFlow(); 