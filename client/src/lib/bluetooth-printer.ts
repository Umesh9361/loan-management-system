const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

const WRITE_CHARACTERISTIC_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
];

const ESC_INIT = new Uint8Array([0x1B, 0x40]);
const ESC_ALIGN_CENTER = new Uint8Array([0x1B, 0x61, 0x01]);
const ESC_ALIGN_LEFT = new Uint8Array([0x1B, 0x61, 0x00]);
const LF = new Uint8Array([0x0A]);
const CUT = new Uint8Array([0x1D, 0x56, 0x00]);
const FEED_LINES = new Uint8Array([0x1B, 0x64, 0x04]);

interface PrinterConnection {
  device: any;
  server: any;
  characteristic: any;
}

let cachedConnection: PrinterConnection | null = null;

function isWebBluetoothSupported(): boolean {
  return !!(navigator as any).bluetooth;
}

async function connectToPrinter(): Promise<PrinterConnection> {
  if (cachedConnection?.server?.connected) {
    try {
      cachedConnection.server.disconnect();
    } catch { /* ignore */ }
    cachedConnection = null;
  }

  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth API उपलब्ध नाही. Chrome/Edge ब्राउझर वापरा.');
  }

  const allServiceUUIDs = PRINTER_SERVICE_UUIDS.map(uuid => uuid.toLowerCase());

  const device = await (navigator as any).bluetooth.requestDevice({
    filters: allServiceUUIDs.map(uuid => ({ services: [uuid] })),
    optionalServices: allServiceUUIDs,
  }).catch(() => {
    return (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: allServiceUUIDs,
    });
  });

  if (!device) throw new Error('प्रिंटर सापडला नाही');

  const server = await device.gatt!.connect();

  let writeCharacteristic: any = null;

  for (const serviceUUID of allServiceUUIDs) {
    try {
      const service = await server.getPrimaryService(serviceUUID);
      for (const charUUID of WRITE_CHARACTERISTIC_UUIDS) {
        try {
          const char = await service.getCharacteristic(charUUID);
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeCharacteristic = char;
            break;
          }
        } catch { /* try next */ }
      }
      if (writeCharacteristic) break;

      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeCharacteristic = char;
          break;
        }
      }
      if (writeCharacteristic) break;
    } catch { /* try next service */ }
  }

  if (!writeCharacteristic) {
    throw new Error('प्रिंटर कनेक्ट झाला पण write characteristic सापडली नाही');
  }

  cachedConnection = { device, server, characteristic: writeCharacteristic };
  return cachedConnection;
}

async function sendData(characteristic: any, data: Uint8Array): Promise<void> {
  const useNoResponse = characteristic.properties.writeWithoutResponse;
  const CHUNK_SIZE = useNoResponse ? 512 : 256;
  const DELAY = useNoResponse ? 3 : 8;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    if (useNoResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
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

function createRasterPrintCommand(bitmap: { width: number; height: number; data: Uint8Array }): Uint8Array {
  const widthBytes = Math.ceil(bitmap.width / 8);
  const h = bitmap.height;

  const header = new Uint8Array([
    0x1D, 0x76, 0x30, 0x00,
    widthBytes & 0xFF,
    (widthBytes >> 8) & 0xFF,
    h & 0xFF,
    (h >> 8) & 0xFF,
  ]);

  return concatUint8Arrays([header, bitmap.data]);
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

export async function printReceiptViaBluetooth(canvas: HTMLCanvasElement, printerWidth: number = 384): Promise<void> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth API उपलब्ध नाही. कृपया Chrome/Edge ब्राउझर वापरा.');
  }

  const connection = await connectToPrinter();

  const bitmap = imageToMonochromeBitmap(canvas, printerWidth);

  const imageCommand = createRasterPrintCommand(bitmap);

  const fullCommand = concatUint8Arrays([
    ESC_INIT,
    ESC_ALIGN_CENTER,
    imageCommand,
    FEED_LINES,
    ESC_ALIGN_LEFT,
  ]);

  await sendData(connection.characteristic, fullCommand);
}

export function isBluetoothSupported(): boolean {
  return isWebBluetoothSupported();
}

export function disconnectPrinter(): void {
  if (cachedConnection?.server?.connected) {
    cachedConnection.server.disconnect();
  }
  cachedConnection = null;
}
