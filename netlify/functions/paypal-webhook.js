const fetch = require('node-fetch');
const crypto = require('crypto');

// PayPal webhook verification
function verifyWebhookSignature(event, headers, webhookId, paypalClientId, paypalClientSecret) {
  const signature = headers['paypal-auth-algo'] + '|' +
                   headers['paypal-cert-url'] + '|' +
                   headers['paypal-transmission-id'] + '|' +
                   headers['paypal-transmission-sig'] + '|' +
                   headers['paypal-transmission-time'];
  
  const expectedSignature = crypto.createHmac('sha256', webhookId)
    .update(event.body)
    .digest('base64');
  
  return signature.includes(expectedSignature);
}

// Append to angler_list.csv
async function appendToCsv(anglerName, githubToken) {
  const repoOwner = 'hackerfrankone';
  const repoName = 'FamilyFishing';
  const filePath = 'CSV/angler_list.csv';
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

  try {
    // Get current file
    const getResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'FamilyFishing-Webhook'
      }
    });
    
    let content = '';
    let sha = '';
    if (getResponse.ok) {
      const fileData = await getResponse.json();
      content = Buffer.from(fileData.content, 'base64').toString('utf8');
      sha = fileData.sha;
    }

    // Append new angler (avoid duplicates)
    const anglerNames = content.split('\n').map(line => line.trim()).filter(line => line);
    if (anglerNames.includes(anglerName)) {
      console.log(`Angler ${anglerName} already in CSV`);
      return true;
    }
    
    const newContent = content.trim() ? `${content}\n${anglerName}` : anglerName;
    const encodedContent = Buffer.from(newContent).toString('base64');

    // Update file
    const updateResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'FamilyFishing-Webhook'
      },
      body: JSON.stringify({
        message: `Add angler ${anglerName} to angler_list.csv`,
        content: encodedContent,
        sha: sha,
        branch: 'main'
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to update CSV: ${updateResponse.statusText}`);
    }

    console.log(`Successfully appended ${anglerName} to angler_list.csv`);
    return true;
  } catch (error) {
    console.error('Error updating CSV:', error);
    throw error;
  }
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  console.log('Received webhook event:', JSON.stringify(event, null, 2));

  try {
    // Parse webhook data
    const webhookData = JSON.parse(event.body);
    console.log('Parsed webhook data:', JSON.stringify(webhookData, null, 2));

    // Verify webhook (optional, enable after initial testing)
    /*
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!verifyWebhookSignature(event, event.headers, webhookId, paypalClientId, paypalClientSecret)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Webhook signature verification failed' }),
      };
    }
    */

    // Check for completed payment
    if (webhookData.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      console.log(`Ignoring event type: ${webhookData.event_type}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Event ignored' }),
      };
    }

    // Extract angler name from custom field
    const anglerName = webhookData.resource.custom || '';
    if (!anglerName) {
      throw new Error('No angler name found in custom field');
    }

    // Append to angler_list.csv
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN not set');
    }

    await appendToCsv(anglerName, githubToken);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Payment processed successfully', angler: anglerName }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
    };
  }
};
