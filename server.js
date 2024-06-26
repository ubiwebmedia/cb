const utils = require('./utils.js');
const BadRequestError = require('./badRequestError.js');
const stripeEvents = require('./stripe/stripeEvents.js');
const chargebeeEvents = require('./chargebee/chargebeeEvents.js');
const express = require('express');
const bodyParser = require('body-parser')

const app = express();

app.get('/', (req, res) => { console.log('receive health check req'); res.send() });

app.post('/success_payment_intent', express.raw({ type: 'application/json' }), stripeEvents.processSuccessPaymentIntent);

app.use(bodyParser.json())

app.post('/invoice_generated', chargebeeEvents.handleInvoiceGeneration);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Running on port ${port}`));