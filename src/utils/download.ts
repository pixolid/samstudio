import type { MaskData } from '@/types/sam'

function triggerDownload(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 3000)
  }, 'image/png')
}

/** Download a binary black/white mask PNG */
export function downloadMask(maskData: MaskData, filename = 'sam2_mask.png') {
  const { mask, numMasks, bestIndex } = maskData
  const { width: w, height: h } = mask

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(w, h)
  const px = imgData.data

  for (let i = 0; i < w * h; i++) {
    const isMask = mask.data[numMasks * i + bestIndex] === 1
    const off = 4 * i
    px[off] = px[off + 1] = px[off + 2] = isMask ? 255 : 0
    px[off + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
  triggerDownload(canvas, filename)
}

/** Download a transparent RGBA cutout, cropped to the bounding box */
export async function downloadCutout(maskData: MaskData, imageUrl: string, filename = 'sam2_cutout.png') {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = imageUrl
  })

  const { mask, numMasks, bestIndex } = maskData
  const { width: mW, height: mH } = mask

  // Draw original image at mask resolution
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = mW
  srcCanvas.height = mH
  srcCanvas.getContext('2d')!.drawImage(img, 0, 0, mW, mH)
  const srcPx = srcCanvas.getContext('2d')!.getImageData(0, 0, mW, mH).data

  const canvas = document.createElement('canvas')
  canvas.width = mW
  canvas.height = mH
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(mW, mH)
  const px = imgData.data

  let minX = mW, minY = mH, maxX = 0, maxY = 0
  for (let i = 0; i < mW * mH; i++) {
    if (mask.data[numMasks * i + bestIndex] === 1) {
      const off = 4 * i
      px[off]     = srcPx[off]
      px[off + 1] = srcPx[off + 1]
      px[off + 2] = srcPx[off + 2]
      px[off + 3] = 255
      const x = i % mW
      const y = Math.floor(i / mW)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  ctx.putImageData(imgData, 0, 0)

  if (maxX >= minX && maxY >= minY) {
    const cropW = maxX - minX + 1
    const cropH = maxY - minY + 1
    const cropped = document.createElement('canvas')
    cropped.width = cropW
    cropped.height = cropH
    cropped.getContext('2d')!.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
    triggerDownload(cropped, filename)
  } else {
    triggerDownload(canvas, filename)
  }
}
