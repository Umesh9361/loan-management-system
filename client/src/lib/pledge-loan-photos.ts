export type PledgeStoredPhoto = { id: string; photoType?: string; createdAt?: string };

const asDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("फोटो वाचता आला नाही."));
  reader.readAsDataURL(blob);
});

export const pledgePhotoImageUrl = (loanId: string, photoId: string) =>
  `/api/loans/${encodeURIComponent(loanId)}/photos/${encodeURIComponent(photoId)}/image`;

export async function fetchPledgePhotoCatalog(loanId: string): Promise<PledgeStoredPhoto[]> {
  const base = `/api/loans/${encodeURIComponent(loanId)}/photos`;
  const response = await fetch(base, { credentials: "include", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("खात्याचे फोटो मिळाले नाहीत. पुन्हा प्रयत्न करा.");
  const photos: unknown = await response.json();
  if (!Array.isArray(photos) || photos.some(photo => !photo || typeof photo.id !== "string")) {
    throw new Error("फोटोंच्या माहितीचे स्वरूप चुकीचे आहे.");
  }
  return [...photos as PledgeStoredPhoto[]].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
}

export function selectPledgeCollateralPhotos(photos: PledgeStoredPhoto[], ids?: string[]) {
  const available = photos.filter(photo => !photo.photoType || photo.photoType === "collateral");
  if (ids === undefined) return available.slice(0, 2);
  if (ids.length > 2 || new Set(ids).size !== ids.length) throw new Error("प्रिंटसाठी जास्तीत जास्त 2 वस्तूंचे फोटो निवडा.");
  return ids.map(id => {
    const photo = available.find(row => row.id === id);
    if (!photo) throw new Error("निवडलेला वस्तूचा फोटो या खात्यात उपलब्ध नाही.");
    return photo;
  });
}

export function pledgeCollateralPhotoLabels(photos: PledgeStoredPhoto[], ids?: string[]) {
  const available = photos.filter(photo => !photo.photoType || photo.photoType === "collateral");
  return selectPledgeCollateralPhotos(photos, ids).map(photo => `वस्तूचा फोटो ${available.findIndex(row => row.id === photo.id) + 1}`);
}

async function readPledgePhoto(loanId: string, photo: PledgeStoredPhoto) {
    const image = await fetch(pledgePhotoImageUrl(loanId, photo.id), { credentials: "include", signal: AbortSignal.timeout(20000) });
    if (!image.ok) throw new Error("एक फोटो उघडता आला नाही. मूळ खात्यात फोटो तपासा किंवा पुन्हा प्रयत्न करा.");
    const blob = await image.blob();
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(blob.type) || blob.size > 10 * 1024 * 1024) {
      throw new Error("फोटोचे स्वरूप किंवा आकार प्रिंटसाठी योग्य नाही.");
    }
    return asDataUrl(blob);
}

export async function loadPledgeCollateralPhotos(loanId: string, ids: string[], catalog?: PledgeStoredPhoto[]) {
  const photos = selectPledgeCollateralPhotos(catalog ?? await fetchPledgePhotoCatalog(loanId), ids);
  return Promise.all(photos.map(photo => readPledgePhoto(loanId, photo)));
}

/** Uses authenticated same-origin media, never arbitrary external image URLs. */
export async function loadPledgeLoanPhotos(loanId: string) {
  const ordered = await fetchPledgePhotoCatalog(loanId);
  const borrower = ordered.filter(photo => photo.photoType === "borrower").at(-1);
  const collateral = selectPledgeCollateralPhotos(ordered);
  const [borrowerPhoto, collateralPhotos] = await Promise.all([
    borrower ? readPledgePhoto(loanId, borrower) : Promise.resolve(""), Promise.all(collateral.map(photo => readPledgePhoto(loanId, photo))),
  ]);
  return { borrowerPhoto, collateralPhotos, collateralPhotoLabels: pledgeCollateralPhotoLabels(ordered) };
}
