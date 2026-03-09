/**
 * @warpkit/storage-firebase
 *
 * Firebase Storage wrapper with reactive uploads for WarpKit.
 *
 * Provides `uploadFile`, `uploadString` for one-shot uploads,
 * `useUpload` for reactive uploads with progress tracking,
 * and `getUrl` for download URL retrieval.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useUpload, getUrl } from '@warpkit/storage-firebase';
 *   import { getStorage } from 'firebase/storage';
 *
 *   const storage = getStorage(firebaseApp);
 *   const uploader = useUpload(storage);
 *
 *   async function handleAvatar(file: File) {
 *     await uploader.upload(`avatars/${userId}`, file, {
 *       cacheControl: 'public,max-age=300'
 *     });
 *   }
 * </script>
 * ```
 *
 * @packageDocumentation
 */

// Upload functions
export { uploadFile, uploadString } from './upload';

// Reactive upload hook
export { useUpload } from './useUpload.svelte';

// Download helper
export { getUrl } from './download';

// Types
export type { UploadResult, UseUploadResult } from './types';
