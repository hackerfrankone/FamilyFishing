const fetch = require('node-fetch'); // For IPN verification

// Dummy store to simulate deduplication (in production, use a DB or KV store)
const processedTransactions = new Set();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  const rawBody = event.body;
  const headers = event.headers;

  // Parse x-www-form-urlencoded body
  const params = new URLSearchParams(rawBody);
  const txn_id = params.get('txn_id');
  const payment_status = params.get('payment_status');
  const payer_email = params.get('payer_email');
  const mc_gross = params.get('mc_gross');
  const custom = params.get('custom');

  // 1. Validate IPN with PayPal
  const verificationBody = `cmd=_notify-validate&${rawBody}`;
  const paypalVerifyUrl = 'https://ipnpb.paypal.com/cgi-bin/webscr';

  let isValid = false;

  try {
    const res = await fetch(paypalVerifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Netlify-IPN-Validator',
      },
      body: verificationBody,
    });

    const text = await res.text();
    if (text === 'VERIFIED') {
      isValid = true;
    }
  } catch (err) {
    console.error('Verification failed:', err);
    return { statusCode: 500, body: 'Verification error' };
  }

  if (!isValid) {
    return { statusCode: 400, body: 'Invalid IPN' };
  }

  // 2. Deduplicate txn_id
  if (processedTransactions.has(txn_id)) {
    return { statusCode: 200, body: 'Duplicate notification ignored' };
  }
  processedTransactions.add(txn_id);

  // 3. Handle payment
  if (payment_status === 'Completed') {
    console.log(`✅ Payment received: $${mc_gross} from ${payer_email}`);
    console.log(`Transaction ID: ${txn_id} | Custom field: ${custom}`);
    // TODO: Trigger your business logic here (e.g., save to DB, send confirmation, etc.)
  }

  return {
    statusCode: 200,
    body: 'OK',
  };
};
