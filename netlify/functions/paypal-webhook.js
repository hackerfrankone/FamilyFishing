const fetch = require('node-fetch');
const crypto = require('crypto');

function verifyWebhookSignature(event, headers, webhookId) {
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

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  console.log('Received webhook event:', JSON.stringify(event, null, 2));

  try {
    const webhookData = JSON.parse(event.body);
    console.log('Parsed webhook data:', JSON.stringify(webhookData, null, 2));

    // Verify webhook (uncomment after setting PAYPAL_WEBHOOK_ID)
    /*
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (webhookId && !verifyWebhookSignature(event, event.headers, webhookId)) {
      return {
        statusCode: 403,
        body: JSON.stringify({ message: 'Webhook signature verification failed' }),
      };
    }
    */

    if (webhookData.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      console.log(`Ignoring event type: ${webhookData.event_type}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Event ignored' }),
      };
    }

    const anglerName = webhookData.resource.custom_id?.trim() || webhookData.resource.custom?.trim();
    if (!anglerName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'No angler name provided in custom or custom_id field' }),
      };
    }
    const sanitizedName = anglerName.replace(/[^a-zA-Z0-9\s]/g, '');
    if (!sanitizedName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid angler name after sanitization' }),
      };
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN not set');
    }
    const repoOwner = 'hackerfrankone';
    const repoName = 'FamilyFishing';
    const filePath = 'CSV/angler_list.csv';
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

    const fileResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'FamilyFishing-Webhook'
      },
    });
    if (!fileResponse.ok) {
      throw new Error(`GitHub API error: ${fileResponse.statusText}`);
    }
    const fileData = await fileResponse.json();
    let anglers = fileData.content
      ? Buffer.from(fileData.content, 'base64').toString().split('\n').filter(line => line.trim())
      : [];

    if (!anglers.includes(sanitizedName)) {
      anglers.push(sanitizedName);
      const newContent = anglers.join('\n');
      const updateResponse = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'FamilyFishing-Webhook'
        },
        body: JSON.stringify({
          message: `Add angler ${sanitizedName} to angler_list.csv`,
          content: Buffer.from(newContent).toString('base64'),
          sha: fileData.sha,
        }),
      });
      if (!updateResponse.ok) {
        throw new Error(`GitHub API update error: ${updateResponse.statusText}`);
      }
      console.log(`Successfully appended ${sanitizedName} to angler_list.csv`);
    } else {
      console.log(`Angler ${sanitizedName} already in CSV`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Angler list updated', angler: sanitizedName }),
    };
  } catch (error) {
    console.error('Error processing webhook:', error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
    };
  }
};
