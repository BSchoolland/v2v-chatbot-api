// Mock Stripe
jest.mock('stripe', () => {
  const mockStripe = {
    customers: {
      create: jest.fn()
    },
    subscriptions: {
      create: jest.fn()
    },
    paymentMethods: {
      retrieve: jest.fn()
    }
  };
  return jest.fn(() => mockStripe);
});

// Mock database functions
jest.mock('../../database/database', () => ({
  dbRun: jest.fn(),
  dbGet: jest.fn(),
  dbAll: jest.fn()
}));

const stripe = require('stripe');
const { 
  createStripeCustomer,
  getStripeCustomer,
  createSubscription,
  updateSubscription,
  addStripePaymentMethod,
  recordInvoice
} = require('../../database/stripe');
const { dbRun, dbGet, dbAll } = require('../../database/database');

// Get the mock Stripe instance
const mockStripe = stripe();

describe('Stripe Database Operations', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Customer Operations', () => {
    test('createStripeCustomer should create a customer in Stripe and database', async () => {
      const mockStripeCustomer = {
        id: 'cus_123',
        email: 'test@example.com'
      };

      mockStripe.customers.create.mockResolvedValue(mockStripeCustomer);
      dbRun.mockResolvedValue({ lastID: 1 });

      const userId = 1;
      const email = 'test@example.com';
      const result = await createStripeCustomer(userId, email);

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email,
        metadata: { userId: '1' }
      });
      expect(dbRun).toHaveBeenCalledWith(
        'INSERT INTO stripe_customers (user_id, stripe_customer_id) VALUES (?, ?)',
        [userId, mockStripeCustomer.id]
      );
      expect(result).toEqual(mockStripeCustomer);
    });

    test('getStripeCustomer should retrieve customer from database', async () => {
      const mockCustomer = {
        customer_id: 1,
        user_id: 1,
        stripe_customer_id: 'cus_123'
      };

      dbGet.mockResolvedValue(mockCustomer);

      const result = await getStripeCustomer(1);

      expect(dbGet).toHaveBeenCalledWith(
        'SELECT * FROM stripe_customers WHERE user_id = ?',
        [1]
      );
      expect(result).toEqual(mockCustomer);
    });
  });

  describe('Subscription Operations', () => {
    test('createSubscription should create a subscription in Stripe and database', async () => {
      const mockPlan = {
        plan_id: 1,
        plan_type_id: 1
      };
      const mockPlanType = {
        name: 'Pro Plan',
        description: 'Professional Plan',
        cost_monthly: 29.99
      };
      const mockStripeSubscription = {
        id: 'sub_123',
        status: 'active',
        current_period_start: 1234567890,
        current_period_end: 1234567890
      };

      dbGet
        .mockResolvedValueOnce(mockPlan)
        .mockResolvedValueOnce(mockPlanType);
      dbRun.mockResolvedValue({ lastID: 1 });
      mockStripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);

      const result = await createSubscription('cus_123', 1, 'pm_123');

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: mockPlanType.name,
                description: mockPlanType.description
              },
              unit_amount: mockPlanType.cost_monthly * 100,
              recurring: {
                interval: 'month'
              }
            }
          }
        ],
        default_payment_method: 'pm_123'
      });

      expect(result).toEqual(mockStripeSubscription);
    });
  });

  describe('Payment Method Operations', () => {
    test('addPaymentMethod should store payment method details', async () => {
      const mockPaymentMethod = {
        id: 'pm_123',
        type: 'card',
        card: {
          last4: '4242',
          exp_month: 12,
          exp_year: 2025
        }
      };

      mockStripe.paymentMethods.retrieve.mockResolvedValue(mockPaymentMethod);
      dbRun.mockResolvedValue({ lastID: 1 });

      const result = await addStripePaymentMethod(1, 'pm_123', true);

      expect(mockStripe.paymentMethods.retrieve).toHaveBeenCalledWith('pm_123');
      expect(dbRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stripe_payment_methods'),
        [
          1,
          mockPaymentMethod.id,
          mockPaymentMethod.type,
          mockPaymentMethod.card.last4,
          mockPaymentMethod.card.exp_month,
          mockPaymentMethod.card.exp_year,
          true
        ]
      );
      expect(result).toEqual(mockPaymentMethod);
    });
  });

  describe('Invoice Operations', () => {
    test('recordInvoice should store invoice details', async () => {
      const mockStripeInvoice = {
        id: 'in_123',
        customer: 'cus_123',
        subscription: 'sub_123',
        amount_due: 2999,
        amount_paid: 2999,
        status: 'paid',
        created: 1234567890,
        due_date: 1234567890,
        status_transitions: {
          paid_at: 1234567890
        }
      };

      const mockCustomer = { customer_id: 1 };
      const mockSubscription = { subscription_id: 1 };

      dbGet
        .mockResolvedValueOnce(mockCustomer)
        .mockResolvedValueOnce(mockSubscription);
      dbRun.mockResolvedValue({ lastID: 1 });

      await recordInvoice(mockStripeInvoice);

      expect(dbRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stripe_invoices'),
        [
          mockCustomer.customer_id,
          mockStripeInvoice.id,
          mockSubscription.subscription_id,
          mockStripeInvoice.amount_due,
          mockStripeInvoice.amount_paid,
          mockStripeInvoice.status,
          mockStripeInvoice.created,
          mockStripeInvoice.due_date,
          mockStripeInvoice.status_transitions.paid_at
        ]
      );
    });
  });
}); 