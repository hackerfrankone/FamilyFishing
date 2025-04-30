const fetch = require("node-fetch");
const qs = require("querystring");
const { Octokit } = require("@octokit/rest");

// GitHub token for authentication (set this in Netlify environment variables)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const ipnData = qs.parse(event.body);
    console.log("IPN Data:", ipnData);

    // Step 1: Verify the IPN with PayPal
    const verificationResponse = await fetch("https://ipnpb.paypal.com/cgi-bin/webscr", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `cmd=_notify-validate&${event.body}`,
    });

    const verificationResult = await verificationResponse.text();
    if (verificationResult !== "VERIFIED") {
      console.error("IPN Verification Failed:", verificationResult);
      return {
        statusCode: 400,
        body: "IPN Verification Failed",
      };
    }

    // Step 2: Extract the payer's first name
    const firstName = ipnData.first_name || "Unknown";
    console.log("Payer First Name:", firstName);

    // Step 3: Update angler_list.csv on GitHub
    const octokit = new Octokit({ auth: GITHUB_TOKEN });
    const owner = "hackerfrankone";
    const repo = "FamilyFishing";
    const path = "angler_list.csv";

    // Get the current content of angler_list.csv
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    const currentContent = Buffer.from(fileData.content, "base64").toString("utf-8");
    const newContent = currentContent.trim() + `\n${firstName}`;
    const newContentBase64 = Buffer.from(newContent).toString("base64");

    // Update the file
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Add ${firstName} to angler_list.csv`,
      content: newContentBase64,
      sha: fileData.sha,
    });

    console.log(`Successfully added ${firstName} to angler_list.csv`);
    return {
      statusCode: 200,
      body: "IPN Processed and angler_list.csv updated",
    };
  } catch (error) {
    console.error("Error processing IPN:", error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};
