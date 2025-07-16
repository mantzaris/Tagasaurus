import { kmeans } from 'ml-kmeans';
import { distanceCosine0to2 } from '$lib/utils/ml-utils';
import type { MediaFile, FaceEmbedding, FaceEmbeddingSample } from '$lib/types/general-types';



const kmeansOptions = {
  maxIterations: 50,
  tolerance: 1e-4,
  distanceFunction: distanceCosine0to2
};


/**
 * Gather faces -> k-means -> medoids -> append extra random faces.
 *
 * @param sample       how many faces to use for clustering   (default 200)
 * @param k            desired cluster count                  (default 10)
 * @param augment      extra random faces to append           (default 0)
 * @param maxAttempts  resampling attempts if faces are scarce (default 10)
 *
 * @returns (kFinal  medoids) + (augment random faces)  in one array
 */
export async function sampleClusterMedoids(
  sample = 200,
  k = 10,
  augment = 0,
  maxAttempts = 10
): Promise<FaceEmbeddingSample[]> {

  const totalWanted = sample + augment;
  const faces = await fetchRandomFaceEmbeddings(totalWanted, maxAttempts);

  if (faces.length === 0) return [];

  let kFinal = faces.length < sample ? Math.round(sample / 20) : k;
  kFinal = Math.max(1, Math.min(kFinal, faces.length));

  const pool      = faces.slice(0, Math.min(sample, faces.length));
  const data      = pool.map(f => f.faceEmbedding);
  const km        = kmeans(data, kFinal, kmeansOptions);
  const medoidIdx = medoidIndices(data, km.clusters, km.centroids);
  const medoids   = medoidIdx.map(i => pool[i]);

  const medoidSet = new Set(medoids); 
  const extras: FaceEmbeddingSample[] = [];

  for (const f of faces) {
    if (extras.length >= augment) break;
    if (!medoidSet.has(f)) extras.push(f);
  }

  return [...medoids, ...extras];
}



function medoidIndices(data: number[][], clusters: number[], centroids: number[][]): number[] {
  const k = centroids.length;
  const best = Array(k).fill(Infinity);
  const idx  = Array(k).fill(-1);

  data.forEach((vec, i) => {
    const c = clusters[i]; // cluster label for this point
    const d = distanceCosine0to2(vec, centroids[c]); // direct vector lookup
    if (d < best[c]) { best[c] = d; idx[c] = i; }
  });
  return idx; // e.g. [42, 817, ...] : row indices in `data`
}


/**
 * Collect up to `target` face embeddings, each annotated with fileHash & fileType.
 */
export async function fetchRandomFaceEmbeddings(
  target: number,
  maxAttempts = 10
): Promise<FaceEmbeddingSample[]> {

  const results: FaceEmbeddingSample[] = [];
  const seenMediaIds = new Set<number>();

  for (let attempt = 0; attempt < maxAttempts && results.length < target; attempt++) {
    const mediaBatch: MediaFile[] = await window.bridge.requestRandomEntries(target);

    const metaById = new Map<number, { fileHash: string; fileType: string }>();
    const newIds: number[] = [];

    for (const m of mediaBatch) {
      if (m.id === undefined || seenMediaIds.has(m.id)) continue;
      seenMediaIds.add(m.id);
      newIds.push(m.id);
      metaById.set(m.id, { fileHash: m.fileHash, fileType: m.fileType });
    }

    if (newIds.length === 0) continue;

    const faceBatch: FaceEmbedding[] =
      await window.bridge.getFaceEmbeddingsById(newIds);

    for (const f of faceBatch) {
      if (results.length >= target) break;
      const meta = metaById.get(f.mediaFileId);
      if (!meta) continue; // should not happen, but be safe
      results.push({ ...f, ...meta });
    }
  }

  return results; // may be < target if dataset is sparse
}
