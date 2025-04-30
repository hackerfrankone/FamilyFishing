exports.handler = async (event, context) => {
  // Check if the request is a POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    // Log the incoming IPN data for debugging
    console.log("IPN Data:", event.body);

    // Respond with a 200 status to acknowledge receipt
    return {
      statusCode: 200,
      body: "IPN Received",
    };
  } catch (error) {
    console.error("Error processing IPN:", error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};
