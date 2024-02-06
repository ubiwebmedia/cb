const stripe = require('stripe')(process.env.STRIPE_API_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET;

var utils = require('./../utils.js');
var BadRequestError = require('./../badRequestError.js');

const stripeService = require('./../stripe/stripeService');
const chargebeService = require('./../chargebee/chargebeeService.js');


async function processSuccessPaymentIntentEvent(request, response) {
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

        const invoice_id = payment_intent_object.invoice;
        const invoice = await stripeService.retrieveInvoice(invoice_id);
        const cb_invoice_id = invoice.metadata.cb_invoice_id;

        await chargebeService.recordInvoicePayment(cb_invoice_id, payment_intent_object.amount_received);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send();

  } catch (err) {
    console.log(err);
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
};


module.exports = {
  processSuccessPaymentIntentEvent,
};
