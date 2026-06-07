// Compress an image File into a JPEG data URL — resized to maxDim and quality
// stepped down until it's under maxBytes. Keeps doubt attachments small enough to
// store inline (no external storage needed) while staying readable.
export function compressImage(file, { maxDim = 1280, quality = 0.72, maxBytes = 480 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load that image.'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff' // flatten transparency for JPEG
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        let q = quality
        let dataUrl = canvas.toDataURL('image/jpeg', q)
        while (dataUrl.length * 0.75 > maxBytes && q > 0.35) {
          q -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', q)
        }
        resolve(dataUrl)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
