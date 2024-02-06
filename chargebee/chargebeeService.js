const chargebee = require("chargebee");

let cbSite = process.env.CB_SITE;
let cbApi = process.env.CB_API_KEY;

chargebee.configure({
  site: cbSite,
  api_key: cbApi
});

async function fetchSubscription(id) {
  const result = await chargebee.subscription.retrieve(id).request();
  return result;
}

async function fetchCustomer(id) {
  const result = await chargebee.customer.retrieve(id).request();
  return result.customer;
}

async function updateCustomer(id, stripe_customer_id) {
  const result = await chargebee.customer.update(id, {
    'cf_stripe_customer_id': stripe_customer_id
  }).request();
  return result;
}

async function retrieveInvoice(id) {
  const result = await chargebee.invoice.retrieve(id).request();
  return result.invoice;
}

async function recordInvoicePayment(id, amount) {
  console.log(`Record offline payment of amount ${amount} for invoice ${id}`);
  const result = await chargebee.invoice.record_payment(id, {
    comment: "Payment received",
    transaction: {
      amount,
      payment_method: "CASH",
      date: Math.ceil(new Date().getTime() / 1000)
    }
  }).request();

  return result;
}

async function listPaymentSource(customer_id) {
  const result = await chargebee.payment_source.list({
    "customer_id[is]": customer_id
  }).request();
  return result.list;
}

async function addComment(entity_id, entity_type, notes) {
  const result = await chargebee.comment.create({
    entity_id,
    entity_type,
    notes
  }).request();

  console.log(JSON.stringify(result));

  return result;
}



module.exports = {
  fetchSubscription,
  fetchCustomer,
  updateCustomer,
  retrieveInvoice,
  recordInvoicePayment,
  listPaymentSource,
  addComment
};