const fetch = require("node-fetch");
const qs = require("querystring");
const { Octokit } = require("@octokit/rest");

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
    const path = "angler_list.csv"; // Double-check this path

    let newContent;
    let fileSha;

    try {
      // Try to fetch the current content of angler_list.csv
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      fileSha = fileData.sha;
      const currentContent = Buffer.from(fileData.content, "base64").toString("utf-8");
      newContent = currentContent.trim() + `\n${firstName}`;
    } catch (error) {
      if (error.status === 404) {
        // If the file doesn't exist, create it with the first name
        console.log("angler_list.csv not found, creating new file...");
        newContent = firstName;
      } else {
        throw error; // Rethrow other errors
      }
    }

    const newContentBase64 = Buffer.from(newContent).toString("base64");

    // Update or create the file
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Add ${firstName} to angler_list.csv`,
      content: newContentBase64,
      sha: fileSha, // Will be undefined if the file is being created
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
