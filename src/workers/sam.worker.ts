// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = any

const MODEL_ID = 'onnx-community/sam2-hiera-tiny-ONNX'
const DTYPE_CONFIG = {
  vision_encoder: 'q4' as const,
  prompt_encoder_mask_decoder: 'q8' as const,
}

let model: AnyModel = null
let processor: AnyModel = null
let imageProcessed: AnyModel = null
let imageEmbeddings: AnyModel = null
let isDecoding = false

function post(msg: object, transfer: Transferable[] = []) {
  self.postMessage(msg, { transfer })
}

async function handleLoadModel() {
  try {
    post({ type: 'status', message: 'Importing model library…' })
    const { Sam2Model, AutoProcessor } = await import('@huggingface/transformers')

    const progressCallback = (p: AnyModel) => {
      if ('progress' in p && typeof p.progress === 'number') {
        post({ type: 'progress', progress: Math.round(p.progress) })
      }
    }

    // Try WebGPU
    if ((self as AnyModel).navigator?.gpu) {
      try {
        post({ type: 'status', message: 'Loading SAM 2 model with WebGPU…' })
        model = await Sam2Model.from_pretrained(MODEL_ID, {
          dtype: DTYPE_CONFIG,
          device: 'webgpu',
          progress_callback: progressCallback,
        })
        processor = await AutoProcessor.from_pretrained(MODEL_ID)
        post({ type: 'model_ready', backend: 'webgpu' })
        return
      } catch (err) {
        console.warn('[Worker] WebGPU failed, falling back to WASM:', err)
      }
    }

    // WASM fallback
    post({ type: 'status', message: 'Loading SAM 2 model with WASM…' })
    model = await Sam2Model.from_pretrained(MODEL_ID, {
      dtype: DTYPE_CONFIG,
      device: 'wasm',
      progress_callback: progressCallback,
    })
    processor = await AutoProcessor.from_pretrained(MODEL_ID)
    post({ type: 'model_ready', backend: 'wasm' })
  } catch (err) {
    post({ type: 'error', error: String(err) })
  }
}

async function handleEncode(url: string) {
  if (!model || !processor) {
    post({ type: 'error', error: 'Model not loaded' })
    return
  }
  post({ type: 'status', message: 'Extracting image embedding…' })
  try {
    const { RawImage } = await import('@huggingface/transformers')

    // Dispose previous
    if (imageEmbeddings) {
      for (const val of Object.values(imageEmbeddings)) {
        (val as AnyModel)?.dispose?.()
      }
      imageEmbeddings = null
    }
    imageProcessed?.pixel_values?.dispose?.()

    const imageInput = await RawImage.fromURL(url)
    imageProcessed = await processor(imageInput)
    imageEmbeddings = await model.get_image_embeddings(imageProcessed)

    post({ type: 'encode_ready' })
  } catch (err) {
    post({ type: 'error', error: String(err) })
  }
}

async function handleDecode(points: Array<{ position: [number, number]; label: 0 | 1 }>) {
  if (!model || !processor || !imageEmbeddings || points.length === 0 || isDecoding) return
  isDecoding = true

  let input_points: AnyModel = null
  let input_labels: AnyModel = null
  let pred_masks: AnyModel = null
  let iou_scores: AnyModel = null

  try {
    const { Tensor, RawImage } = await import('@huggingface/transformers')

    const reshaped = imageProcessed.reshaped_input_sizes[0]
    const pointsFlat = points.map(p => [p.position[0] * reshaped[1], p.position[1] * reshaped[0]]).flat()
    const labelsFlat = points.map(p => BigInt(p.label))

    input_points = new Tensor('float32', pointsFlat, [1, 1, points.length, 2])
    input_labels = new Tensor('int64', labelsFlat, [1, 1, points.length])

    const result = await model({ ...imageEmbeddings, input_points, input_labels })
    pred_masks = result.pred_masks
    iou_scores = result.iou_scores

    const masks = await processor.post_process_masks(
      pred_masks,
      imageProcessed.original_sizes,
      imageProcessed.reshaped_input_sizes,
    )

    const mask = RawImage.fromTensor(masks[0][0])
    const scoresRaw = iou_scores.data as Float32Array

    let bestIndex = 0
    for (let i = 1; i < scoresRaw.length; i++) {
      if (scoresRaw[i] > scoresRaw[bestIndex]) bestIndex = i
    }

    // Copy to plain transferable arrays
    const maskData = new Uint8Array(mask.data)
    const scores = new Float32Array(scoresRaw)

    post(
      {
        type: 'decode_result',
        mask: { data: maskData, width: mask.width, height: mask.height, channels: mask.channels ?? 1, numMasks: scoresRaw.length },
        scores,
        bestIndex,
        numMasks: scoresRaw.length,
      },
      [maskData.buffer, scores.buffer],
    )
  } catch (err) {
    post({ type: 'error', error: String(err) })
  } finally {
    input_points?.dispose?.()
    input_labels?.dispose?.()
    pred_masks?.dispose?.()
    iou_scores?.dispose?.()
    isDecoding = false
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, ...data } = e.data
  switch (type) {
    case 'load_model': await handleLoadModel(); break
    case 'encode_image': await handleEncode(data.url); break
    case 'decode': await handleDecode(data.points); break
  }
}