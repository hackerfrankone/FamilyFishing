// netlify/functions/paypal-webhook.js
exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  console.log('Received webhook event:', event);

  try {
    // Log the raw body to inspect it
    console.log('Request body:', event.body);

    // Parse the incoming JSON payload
    const webhookData = JSON.parse(event.body);
    console.log('Parsed webhook data:', webhookData);

    // If everything is fine, proceed to your business logic...
    const anglerName = webhookData.name;  // Example: Extract name from PayPal data
    // Add code to update the CSV or database with this angler's name

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Payment processed successfully' }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
    };
  }
};
