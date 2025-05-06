exports.handler = async (event) => {
  try {
    const payload = JSON.parse(event.body);
    if (payload.event_type !== 'PAYMENT.SALE.COMPLETED') {
      return { statusCode: 400, body: 'Invalid event type' };
    }
    const anglerName = payload.custom?.trim();
    if (!anglerName) {
      return { statusCode: 400, body: 'No angler name provided' };
    }
    // Sanitize input
    const sanitizedName = anglerName.replace(/[^a-zA-Z0-9\s]/g, '');
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = 'hackerfrankone';
    const repoName = 'FamilyFishing';
    const filePath = 'CSV/angler_list.csv';

    // Fetch current CSV
    const fileResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (!fileResponse.ok) {
      throw new Error(`GitHub API error: ${fileResponse.status}`);
    }
    const fileData = await fileResponse.json();
    let anglers = fileData.content
      ? Buffer.from(fileData.content, 'base64').toString().split('\n').filter((line) => line.trim())
      : [];

    // Add new angler if not present
    if (!anglers.includes(sanitizedName)) {
      anglers.push(sanitizedName);
      const newContent = anglers.join('\n');
      const updateResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `Add angler ${sanitizedName} to angler_list.csv`,
            content: Buffer.from(newContent).toString('base64'),
            sha: fileData.sha,
          }),
        }
      );
      if (!updateResponse.ok) {
        throw new Error(`GitHub API update error: ${updateResponse.status}`);
      }
    }
    return { statusCode: 200, body: 'Angler list updated' };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: 'Server error' };
  }
};
