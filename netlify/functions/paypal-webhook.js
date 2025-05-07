exports.handler = async (event, context) => {
  try {
    // Log the entire event for debugging
    console.log("Full event:", JSON.stringify(event, null, 2));

    // Check if body exists and is not empty
    if (!event.body) {
      console.log("No body received in request");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Empty request body" }),
      };
    }

    // Log the raw body
    console.log("Webhook received, raw body:", event.body);

    // Try parsing the body as JSON
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON payload" }),
      };
    }

    // Log parsed payload and event type
    console.log("Parsed payload:", payload);
    console.log("Event type:", payload.event_type || "Not specified");

    // Return success response
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
