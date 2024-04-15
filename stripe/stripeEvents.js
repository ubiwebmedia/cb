const stripe = require('stripe')(process.env.STRIPE_API_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET;

var utils = require('./../utils.js');
var BadRequestError = require('./../badRequestError.js');

const stripeService = require('./../stripe/stripeService');
const chargebeService = require('./../chargebee/chargebeeService.js');


async function processSuccessPaymentIntent(req, res) {
  let response = await processSuccessPaymentIntentEvent(req, res);
  console.log(response);
  res.status(response.statusCode).send(response.body);
}

async function processSuccessPaymentIntentEvent(request) {
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log("Received payment_intent.succeeded event : " + JSON.stringify(event));
        const payment_intent_object = event.data.object;

        if (!payment_intent_object.payment_method_types.includes("acss_debit")) {
          return await utils.getAsResponse('error', 'payment method type is not acss_debit', 200);
        }

        const paymentMethod = await stripeService.retrievePaymentMethod(payment_intent_object.payment_method);
        if (paymentMethod.type != "acss_debit")
          return await utils.getAsResponse('error', `payment method type is ${paymentMethod.type}`, 200);

        var stripe_customer = await stripeService.retrieveCustomer(payment_intent_object.customer);
        if (!stripe_customer?.invoice_settings?.default_payment_method) {
          stripe_customer = await stripeService.updateCustomerDefaultPaymentMethod(stripe_customer.id, payment_intent_object.payment_method);
        }

        const invoice_id = payment_intent_object.invoice;
        const invoice = await stripeService.retrieveInvoice(invoice_id);
        const cb_invoice_id = invoice.metadata.cb_invoice_id;

        await chargebeService.recordInvoicePayment(cb_invoice_id, payment_intent_object.amount_received);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return await utils.getAsResponse('success', 'success', 200);
  } catch (err) {
    console.log(err);
    return await utils.getAsResponse('error', `Webhook Error: ${err.message}`, 400);
    return;
  }
};


module.exports = {
  processSuccessPaymentIntent,
};
