// Wait for images
window.__allImagesLoaded = new Promise((resolve) => {
  const images = Array.from(document.images);
  if (images.length === 0) { resolve(); return; }
  let loaded = 0;
  function checkDone() {
    loaded++;
    if (loaded >= images.length) resolve();
  }
  images.forEach(img => {
    if (img.complete) { checkDone(); }
    else { img.addEventListener('load', checkDone); img.addEventListener('error', checkDone); }
  });
});
