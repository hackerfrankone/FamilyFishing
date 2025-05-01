const fs = require('fs-extra');
const path = require('path');

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

    // Update archive.json
    let archiveData = [];
    if (await fs.pathExists(archiveJsonPath)) {
      archiveData = await fs.readJson(archiveJsonPath);
    }
    archiveData.unshift({
      month: monthStr,
      filename,
      angler: 'Unknown' // Replace with actual angler name, e.g., from a CSV
    });
    await fs.writeJson(archiveJsonPath, archiveData, { spaces: 2 });
    console.log('Updated archive.json');
  } catch (error) {
    console.error('Error archiving image:', error);
    process.exit(1);
  }
}

archiveImage();
