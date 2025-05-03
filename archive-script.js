fetch('./archive.json')
  .then(res => res.json())
  .then(archive => {
    console.log("Loaded archive:", archive);

    // Example: loop and show each winner
    archive.forEach(entry => {
      console.log(`${entry.month}: ${entry.angler} - ${entry.filename}`);
    });
  })
  .catch(err => {
    console.error("Failed to load archive.json:", err);
  });
