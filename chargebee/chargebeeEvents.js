var chargebee = require("chargebee");
var utils = require('./../utils.js');
var BadRequestError = require('./../badRequestError.js');
var chargebeeService = require('./../chargebee/chargebeeService.js');
const stripeService = require('./../stripe/stripeService.js');

let cbSite = process.env.CB_SITE;

async function handleInvoiceGeneration(req, res) {
  let response = await handleInvoiceGenerationEvent(req.body);
  console.log(response);
  res.status(response.statusCode).send(response.body);
}

async function handleInvoiceGenerationEvent(event) {
  try {
    // Handle the webhook event here
    console.log('Received webhook event:', event)

    const eventType = event.event_type;
    const content = event.content;

    if (eventType !== 'invoice_generated') {
      console.error("Invalid event type:" + eventType);
      return await utils.getAsResponse('error', 'invalid event type', 200);
    }
    const invJson = event.content.invoice;
    const invoice = await chargebeeService.retrieveInvoice(invJson.id);

    try {
      return await processInvoice(invoice);
    } catch (err) {
      console.error(err);
      if (err instanceof BadRequestError) {
        return await utils.getAsResponse('error', err.message, 200);//return 200, instead of actual error code, 
        //because chargebee will retry if response if not 200
        //we need to fix these errors before retry
      }
      return await utils.getAsResponse('error', 'internal server error', 500);
    }
  } catch (err) {
    console.error(err);
    return await utils.getAsResponse('error', 'internal server error', 500);
  }
}

async function processInvoice(invoice) {
  if (invoice.status === 'paid') {
    return await utils.getAsResponse('error', 'invoice is in paid status', 200);
  }

  if (invoice.currency_code != 'CAD') {
    return await utils.getAsResponse('error', 'currency code is not CAD', 200);
  }

  const line_items = invoice.line_items;
  const subscriptionIds = [...new Set(line_items.map(item => item.subscription_id))];

  for (const sub_id of subscriptionIds) {

    if (sub_id == null) {
      return await utils.getAsResponse('error', 'internal server error', 500);
    }

    const subscriptionResult = await chargebeeService.fetchSubscription(sub_id);

    const subscription = subscriptionResult.subscription;

    if (subscription.offline_payment_method != 'cash') {
      return await utils.getAsResponse('error', 'offline payment method is not cash', 200);
    }
  }

  const customer = await chargebeeService.fetchCustomer(invoice.payment_owner ?? invoice.customer_id);

  var stripeCustomer = null;
  if (!customer.cf_stripe_customer_id) {
    stripeCustomer = await fetchStripeCustomerFromPaymentSource(customer);

    if (stripeCustomer == null) {
      stripeCustomer = await stripeService.createCustomer(customer.id, customer.email, customer.phone, customer.billing_address);
      var customerResult = await chargebeeService.updateCustomer(customer.id, stripeCustomer.id);
    }
  } else {
    stripeCustomer = await stripeService.retrieveCustomer(customer.cf_stripe_customer_id);
  }

  if (await invoiceDuplicateCheck(invoice.id, stripeCustomer)) {
    return await utils.getAsResponse('error', 'invoice already exists in stripe', 200);
  }

  const stripe_invoice = await stripeService.createInvoiceAndSendEmail(stripeCustomer.id, invoice.id, invoice.currency_code, invoice.due_date, line_items);

  var notes = `https://dashboard.stripe.com/invoices/${stripe_invoice.id}`;
  if (cbSite.endsWith('-test'))
    notes = `https://dashboard.stripe.com/test/invoices/${stripe_invoice.id}`;

  await chargebeeService.addComment(invoice.id, 'invoice', `stripe invoice url - ${notes}`);

  return await utils.getAsResponse('success', 'success', 200);
}

async function fetchStripeCustomerFromPaymentSource(customer) {
  var payment_sources = await chargebeeService.listPaymentSource(customer.id);
  payment_sources = payment_sources.filter((payment_source) => payment_source.payment_source.gateway === "stripe").map(payment_source => payment_source?.payment_source?.reference_id);

  if (payment_sources.length > 0) {
    const payment_source = payment_sources[0];
    if (payment_source) {
      var stripe_customer_id = payment_sources[0].split("/")[0];
      var stripeCustomer = await stripeService.retrieveCustomer(stripe_customer_id);
      return stripeCustomer;
    }
  }
  return null;
}

async function invoiceDuplicateCheck(cb_invoice_id, stripeCustomer) {
  const invoices = await stripeService.listInvoice(stripeCustomer.id);
  for (const invoice of invoices?.data) {
    if (invoice?.metadata?.cb_invoice_id === cb_invoice_id)
      return true;
  }
  return false;
}



module.exports = {
  handleInvoiceGeneration,
};