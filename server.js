const utils = require('./utils.js');
const BadRequestError = require('./badRequestError.js');
const stripeEvents = require('./stripe/stripeEvents.js');
const chargebeeEvents = require('./chargebee/chargebeeEvents.js');
const express = require('express');
const bodyParser = require('body-parser')

const app = express();

app.post('/success_payment_intent', express.raw({ type: 'application/json' }), stripeEvents.processSuccessPaymentIntentEvent);

app.use(bodyParser.json())

app.post('/invoice_generated', chargebeeEvents.handleInvoiceGeneration);

app.listen(4242, () => console.log('Running on port 4242'));