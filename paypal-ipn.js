
// functions/paypal-ipn.js
const fetch = require('node-fetch');
const querystring = require('querystring');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      console.log('Invalid method:', event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }

    const ipnData = querystring.parse(event.body);
    console.log('Received IPN:', ipnData);

    const verificationUrl = 'https://www.paypal.com/cgi-bin/webscr';
    const verificationBody = `cmd=_notify-validate&${event.body}`;
    const response = await fetch(verificationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verificationBody,
    });
    const verificationResult = await response.text();
    console.log('Verification result:', verificationResult);

    if (verificationResult !== 'VERIFIED') {
      console.error('IPN verification failed:', verificationResult);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid IPN' }),
      };
    }

    console.log('Payment status:', ipnData.payment_status);
    if (ipnData.payment_status !== 'Completed') {
      console.log('Payment not completed:', ipnData.payment_status);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Payment not completed' }),
      };
    }

    const buyerName = `${ipnData.payer_first_name} ${ipnData.payer_last_name}`.trim();
    console.log('Extracted buyer name:', buyerName);
    if (!buyerName) {
      console.error('No buyer name found in IPN data');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No buyer name provided' }),
      };
    }

    const updateResult = await updateGitHubAnglerList(buyerName);
    console.log('GitHub update result:', updateResult);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Angler added successfully', result: updateResult }),
    };
  } catch (error) {
    console.error('Error processing IPN:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

async function updateGitHubAnglerList(buyerName) {
  const githubToken = process.env.GITHUB_TOKEN;
  console.log('GitHub token present:', !!githubToken);
  const repoOwner = 'hackerfrankone';
  const repoName = 'FamilyFishing';
  const filePath = 'angler_list.csv';
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

  try {
    const getResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    const fileData = await getResponse.json();
    console.log('GitHub file data:', fileData);
    if (!getResponse.ok) {
      throw new Error(`Failed to fetch file: ${fileData.message}`);
    }

    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    console.log('Current CSV content:', currentContent);

    const lines = currentContent.split('\n').filter(line => line.trim());
    console.log('Checking for duplicate:', lines.includes(buyerName));
    if (lines.includes(buyerName)) {
      return { success: false, message: 'Angler already exists' };
    }
    const newContent = `${currentContent.trim()}\n${buyerName}`;
    const newContentBase64 = Buffer.from(newContent).toString('base64');
    console.log('New CSV content:', newContent);

    const updateResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Add angler ${buyerName} to angler_list.csv`,
        content: newContentBase64,
        sha: fileData.sha,
        branch: 'main',
      }),
    });
    const updateResult = await updateResponse.json();
    console.log('GitHub update response:', updateResult);
    if (!updateResponse.ok) {
      throw new Error(`Failed to update file: ${updateResult.message}`);
    }

    return { success: true, message: 'Angler added successfully' };
  } catch (error) {
    console.error('Error updating GitHub file:', error);
    throw error;
  }
}
