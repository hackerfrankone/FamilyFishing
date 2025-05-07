exports.handler = async (event, context) => {
  try {
    // Log the incoming webhook data
    console.log("Webhook received:", event.body);

    // Parse the body (PayPal sends JSON)
    const payload = JSON.parse(event.body);

    // Log specific details for debugging
    console.log("Event type:", payload.event_type);
    console.log("Payload:", payload);

    // Return a 200 status to acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Webhook received" }),
    };
  } catch (error) {
    console.error("Error processing webhook:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process webhook" }),
    };
  }
};
