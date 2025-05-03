const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');

async function getAnglerName() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/hackerfrankone/FamilyFishing/main/images/current/current_winner');
    const text = await response.text();
    return text.trim() || 'Unknown';
  } catch (error) {
    console.error('Error fetching angler name:', error);
    return 'Unknown';
  }
}

async function archiveImage() {
  try {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const monthName = lastMonth.toLocaleString('default', { month: 'long' });
    const year = lastMonth.getFullYear();
    const monthStr = `${monthName} ${year}`;
    const filename = `bass_${monthName.toLowerCase()}_${year}.jpg`;

    // Paths
    const currentImagePath = path.join(__dirname, 'images', 'current', filename);
    const archiveImagePath = path.join(__dirname, 'images', 'archive', filename);
    const archiveJsonPath = path.join(__dirname, 'images', 'archive', 'archive.json');

    // Copy image to archive
    if (await fs.pathExists(currentImagePath)) {
      await fs.copy(currentImagePath, archiveImagePath);
      console.log(`Copied ${currentImagePath} to ${archiveImagePath}`);
    } else {
      console.error('Current image not found');
      return;
    }

    // Get angler name
    const anglerName = await getAnglerName();

    // Update archive.json
    let archiveData = [];
    if (await fs.pathExists(archiveJsonPath)) {
      archiveData = await fs.readJson(archiveJsonPath);
    }
    archiveData.unshift({
      month: monthStr,
      filename: `images/archive/${filename}`, // Full path for archive.html
      angler: anglerName
    });
    await fs.writeJson(archiveJsonPath, archiveData, { spaces: 2 });
    console.log('Updated archive.json');
  } catch (error) {
    console.error('Error archiving image:', error);
    process.exit(1);
  }
}

archiveImage();
