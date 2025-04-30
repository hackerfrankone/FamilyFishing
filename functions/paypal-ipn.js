// functions/paypal-ipn.js
const fetch = require('node-fetch');
const querystring = require('querystring');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

    const ipnData = querystring.parse(event.body);
    const verificationUrl = 'https://ipnpb.paypal.com/cgi-bin/webscr'; // More reliable IPN endpoint
    const verificationBody = `cmd=_notify-validate&${event.body}`;

    const verificationRes = await fetch(verificationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verificationBody,
    });

    const verificationText = await verificationRes.text();

    if (verificationText !== 'VERIFIED') {
      console.error('PayPal IPN NOT verified:', verificationText);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid IPN' }),
      };
    }

    if (ipnData.payment_status !== 'Completed') {
      console.log(`Payment status: ${ipnData.payment_status}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Payment not completed' }),
      };
    }

    const buyerName = `${ipnData.payer_first_name} ${ipnData.payer_last_name}`.trim();
    if (!buyerName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing buyer name' }),
      };
    }

    const result = await updateGitHubAnglerList(buyerName);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

async function updateGitHubAnglerList(buyerName) {
  const githubToken = process.env.GITHUB_TOKEN;
  const repoOwner = 'hackerfrankone';
  const repoName = 'FamilyFishing';
  const filePath = 'angler_list.csv';
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
  };

  try {
    const getRes = await fetch(apiUrl, { headers });
    const fileData = await getRes.json();

    if (!getRes.ok) {
      throw new Error(`GitHub fetch error: ${fileData.message}`);
    }

    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const names = currentContent.split('\n').map(line => line.trim()).filter(Boolean);

    if (names.includes(buyerName)) {
      return { success: false, message: 'Angler already exists' };
    }

    const updatedContent = [...names, buyerName].join('\n');
    const newBase64 = Buffer.from(updatedContent, 'utf-8').toString('base64');

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Add angler: ${buyerName}`,
        content: newBase64,
        sha: fileData.sha,
        branch: 'main',
      }),
    });

    const result = await putRes.json();

    if (!putRes.ok) {
      throw new Error(`GitHub update error: ${result.message}`);
    }

    return { success: true, message: 'Angler added successfully' };

  } catch (err) {
    console.error('GitHub update failed:', err);
    throw err;
  }
}
