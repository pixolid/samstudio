/**
 * Computes the rendered geometry of an image inside a container
 * using object-fit: contain logic.
 */
export interface CanvasGeometry {
  width: number
  height: number
  top: number
  left: number
}

export function computeContainGeometry(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): CanvasGeometry {
  const imageAR = imageWidth / imageHeight
  const containerAR = containerWidth / containerHeight

  let width: number, height: number, top: number, left: number

  if (imageAR > containerAR) {
    width = containerWidth
    height = width / imageAR
    top = (containerHeight - height) / 2
    left = 0
  } else {
    height = containerHeight
    width = height * imageAR
    left = (containerWidth - width) / 2
    top = 0
  }

  return { width, height, top, left }
}

/** Clamp a value between min and max */
export function clamp(x: number, min = 0, max = 1): number {
  return Math.max(Math.min(x, max), min)
}
