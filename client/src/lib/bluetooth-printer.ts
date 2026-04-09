const ESC_INIT = new Uint8Array([0x1B, 0x40]);
const ESC_ALIGN_CENTER = new Uint8Array([0x1B, 0x61, 0x01]);
const ESC_ALIGN_LEFT = new Uint8Array([0x1B, 0x61, 0x00]);
const FEED_LINES = new Uint8Array([0x1B, 0x64, 0x04]);

function isWebBluetoothSupported(): boolean {
  return !!(navigator as any).bluetooth;
}

export async function connectBluetoothPrinter(): Promise<{ characteristic: any }> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth API उपलब्ध नाही. Chrome/Edge ब्राउझर वापरा.');
  }

  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      '000018f0-0000-1000-8000-00805f9b34fb',
      '0000ff00-0000-1000-8000-00805f9b34fb',
      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    ],
  });

  if (!device) throw new Error('प्रिंटर सापडला नाही');

  const server = await device.gatt!.connect();

  const serviceUUIDs = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  ];

  const writeCharUUIDs = [
    '00002af1-0000-1000-8000-00805f9b34fb',
    '0000ff02-0000-1000-8000-00805f9b34fb',
    'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
    '49535343-8841-43f4-a8d4-ecbe34729bb3',
  ];

  let writeChar: any = null;

  for (const svcUUID of serviceUUIDs) {
    try {
      const service = await server.getPrimaryService(svcUUID);
      for (const cUUID of writeCharUUIDs) {
        try {
          const c = await service.getCharacteristic(cUUID);
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        } catch { /* next char */ }
      }
      if (writeChar) break;

      const allChars = await service.getCharacteristics();
      for (const c of allChars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          writeChar = c;
          break;
        }
      }
      if (writeChar) break;
    } catch { /* next service */ }
  }

  if (!writeChar) {
    server.disconnect();
    throw new Error('प्रिंटर कनेक्ट झाला पण write characteristic सापडली नाही');
  }

  return { characteristic: writeChar };
}

async function writeChunk(characteristic: any, chunk: Uint8Array): Promise<void> {
  if (characteristic.properties.write) {
    await characteristic.writeValue(chunk);
  } else {
    await characteristic.writeValueWithoutResponse(chunk);
  }
}

async function sendData(characteristic: any, data: Uint8Array, mode: 'tight' | 'loose' = 'tight'): Promise<void> {
  const CHUNK = 200;
  const DELAY = mode === 'loose' ? 5 : 8;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    await writeChunk(characteristic, chunk);
    await new Promise(r => setTimeout(r, DELAY));
  }
}

function imageToMonochromeBitmap(canvas: HTMLCanvasElement, targetWidth: number): { width: number; height: number; data: Uint8Array } {
  const tempCanvas = document.createElement('canvas');
  const scale = targetWidth / canvas.width;
  tempCanvas.width = targetWidth;
  tempCanvas.height = Math.round(canvas.height * scale);
  const ctx = tempCanvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

  const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const pixels = imageData.data;
  const w = tempCanvas.width;
  const h = tempCanvas.height;

  const widthBytes = Math.ceil(w / 8);
  const bitmap = new Uint8Array(widthBytes * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const gray = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      if (gray < 128) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        bitmap[byteIdx] |= (0x80 >> (x % 8));
      }
    }
  }

  return { width: w, height: h, data: bitmap };
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function buildBitmapCommand(canvas: HTMLCanvasElement, printerWidth: number): Uint8Array {
  const bitmap = imageToMonochromeBitmap(canvas, printerWidth);
  const widthBytes = Math.ceil(bitmap.width / 8);
  const header = new Uint8Array([
    0x1D, 0x76, 0x30, 0x00,
    widthBytes & 0xFF,
    (widthBytes >> 8) & 0xFF,
    bitmap.height & 0xFF,
    (bitmap.height >> 8) & 0xFF,
  ]);
  return concatUint8Arrays([header, bitmap.data]);
}

export async function sendPrintData(characteristic: any, canvas: HTMLCanvasElement, printerWidth: number = 384, mode: 'tight' | 'loose' = 'tight', isFirst: boolean = true, isLast: boolean = true): Promise<void> {
  const bitmapCmd = buildBitmapCommand(canvas, printerWidth);
  const parts: Uint8Array[] = [];
  if (isFirst) {
    parts.push(ESC_INIT, ESC_ALIGN_CENTER);
  }
  parts.push(bitmapCmd);
  if (isLast) {
    parts.push(FEED_LINES, ESC_ALIGN_LEFT);
  }
  await sendData(characteristic, concatUint8Arrays(parts), mode);
}

export async function printReceiptViaBluetooth(canvas: HTMLCanvasElement, printerWidth: number = 384): Promise<void> {
  const connection = await connectBluetoothPrinter();
  await sendPrintData(connection.characteristic, canvas, printerWidth, 'tight', true, true);
}

export function isBluetoothSupported(): boolean {
  return isWebBluetoothSupported();
}
