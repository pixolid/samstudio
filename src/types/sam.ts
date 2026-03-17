export interface SegmentationPoint {
  position: [number, number] // normalized [0,1]
  label: 0 | 1              // 0 = exclude, 1 = include
}

export interface MaskData {
  mask: {
    data: Uint8Array | Int8Array | Float32Array | Uint8ClampedArray
    width: number
    height: number
    channels: number
  }
  scores: Float32Array | number[]
  bestIndex: number
  numMasks: number
}

export type BackendType = 'webgpu' | 'wasm'

export interface ModelState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  backend: BackendType | null
  progress: number
  statusMessage: string
  error: string | null
}

// Image data from RawImage for cutout export
export interface RawImageData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  width: number
  height: number
  channels: number
}
