const stripe = require('stripe')(process.env.STRIPE_API_SECRET_KEY);

async function createCustomer(cb_customer_id, email, phone, address) {
  const customer = await stripe.customers.create({
    email,
    phone,
    address: {
      city: address?.city,
      country: address?.country,
      line1: address?.line1,
      line2: address?.line2,
      postal_code: address?.zip,
      state: address?.state
    },
    description: `Chargebee handle: ${cb_customer_id}`,
    metadata: {
      cb_customer_id
    }
  });

  return customer;
}

async function retrieveCustomer(id) {
  const customer = await stripe.customers.retrieve(id);
  return customer;
}

async function retrieveInvoice(id) {
  const invoice = await stripe.invoices.retrieve(id);
  return invoice;
}

async function retrievePaymentMethod(id) {
  const paymentMethod = await stripe.paymentMethods.retrieve(id);
  return paymentMethod;
}


async function listInvoice(customer_id) {
  const invoices = await stripe.invoices.list({
    customer: customer_id
  });

  return invoices;
}

async function createInvoiceAndSendEmail(customer_id, invoice_id, currency_code, due_date, line_items) {
  try {
    // Create an invoice in Stripe for the customer
    const invoice = await stripe.invoices.create({
      customer: customer_id, // Customer ID from Stripe
      collection_method: 'send_invoice',
      days_until_due: 0,
      payment_settings: {
        payment_method_types: ['acss_debit']
      },
      custom_fields: [
        {
          name: 'CB Invoice Number',
          value: invoice_id
        }
      ],
      metadata: {
        cb_invoice_id: invoice_id
      }
    });

    for (var i = 0; i < line_items.length; i++) {
      var line_item = line_items[i];
      // Add line items to the created invoice
      const lineItem1 = await stripe.invoiceItems.create({
        customer: customer_id,
        invoice: invoice.id,
        amount: line_item.amount - line_item.discount_amount + line_item.tax_amount,
        currency: currency_code,
        description: line_item?.description,
        period: {
          start: line_item.date_from,
          end: line_item.date_to
        },
        metadata: {
          amount: line_item.amount,
          discount_amount: line_item.discount_amount,
          tax_rate: line_item?.tax_rate,
          tax_amount: line_item?.tax_amount,
        },
      });
    }

    // Finalize the invoice
    const final_invoice = await stripe.invoices.finalizeInvoice(invoice.id);

    return final_invoice;
  } catch (error) {
    console.error('Error creating invoice:', error);
  }
}

module.exports = {
  createCustomer,
  retrieveCustomer,
  retrieveInvoice,
  retrievePaymentMethod,
  createInvoiceAndSendEmail,
  listInvoice
};
