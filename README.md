# SAM Studio

In-browser image segmentation powered by SAM 3 and WebGPU. No server, no API keys, runs 100% client-side.

### Vercel Setup

1. Push this folder to `https://github.com/pixolid/sam-studio` (or similar).
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Vercel will automatically detect settings. Deploy.
4. Set the custom domain in Vercel project settings to `pixolid.de/samstudio`.

## Local Development

```bash
python -m http.server 8080
# then open http://localhost:8080
```

## Requirements

- A browser with WebGPU support (Chrome 113+, Edge 113+).
- ~200 MB model download on first visit (cached automatically).

## License

MIT
