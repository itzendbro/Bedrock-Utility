import JSZip, { JSZipObject } from 'jszip';
import { UploadedFile, GeneratedFile, AssetMapping } from '../types';

/**
 * Converts a File object to a base64 encoded string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove data:mime/type;base64, prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Creates a zip file from the generated files and initiates a download.
 */
export const downloadAddon = async (
  addonName: string,
  files: GeneratedFile[],
  uploadedFiles: UploadedFile[],
  assetMappings: AssetMapping[]
) => {
  const zip = new JSZip();

  // Add generated files to the zip
  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  // Add original assets that were mapped to new paths.
  for (const mapping of assetMappings) {
    let found = false;
    let targetFile: File | null = null;
    
    // The AI might provide a full path or just a filename for originalPath.
    // The uploadedFiles list can contain loose files or files extracted from zips (with full internal paths).
    // Strategy:
    // 1. Look for an exact match first.
    // 2. If no exact match, look for a unique file that ends with the originalPath.
    // 3. If multiple files end with originalPath, warn about ambiguity but proceed with the first match.
    const looseMatches = uploadedFiles.filter(uf => uf.file.name.endsWith(mapping.originalPath));
    
    if (looseMatches.length > 0) {
        // Prefer an exact match if available among the potential matches.
        const exactMatch = looseMatches.find(uf => uf.file.name === mapping.originalPath);
        if (exactMatch) {
            targetFile = exactMatch.file;
        } else {
            if (looseMatches.length > 1) {
                console.warn(`Ambiguous asset mapping for '${mapping.originalPath}'. Multiple files matched: ${looseMatches.map(f => f.file.name).join(', ')}. Using the first one found: '${looseMatches[0].file.name}'.`);
            }
            targetFile = looseMatches[0].file;
        }
    }

    if (targetFile) {
        zip.file(mapping.newPath, targetFile);
        found = true;
    } else {
        // Fallback: search inside any zips that might not have been pre-processed.
        // This is mainly for edge cases, as Combine/Fix tools pre-unzip everything.
        for (const uf of uploadedFiles) {
            const fileName = uf.file.name.toLowerCase();
            if (fileName.endsWith('.zip') || fileName.endsWith('.mcaddon') || fileName.endsWith('.mcpack')) {
                try {
                    const uploadedZip = await JSZip.loadAsync(uf.file);
                    // Fix: `assetFile.async` caused an error because `assetFile` was of type `unknown`.
                    // This can happen if the project's TypeScript configuration causes `Object.values` to return `unknown[]`.
                    // By casting the result to `JSZipObject[]`, we ensure TypeScript can correctly infer the types
                    // for both `file` in the callback and `assetFile` itself, resolving the error.
                    const assetFile = (Object.values(uploadedZip.files) as JSZipObject[]).find(
                        (file) => !file.dir && file.name.endsWith(mapping.originalPath)
                    );

                    if (assetFile) {
                        const assetContent = await assetFile.async('blob');
                        zip.file(mapping.newPath, assetContent);
                        found = true;
                        break;
                    }
                } catch (e) {
                    console.error(`Error reading zip file ${uf.file.name} while searching for asset ${mapping.originalPath}`, e);
                }
            }
        }
    }

    if (!found) {
        console.warn(`Asset for mapping '${mapping.originalPath}' -> '${mapping.newPath}' not found in any uploaded files or zips.`);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = `${addonName}.mcaddon`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Packages user-provided zip files (RP and BP) into a single .mcaddon file and downloads it.
 */
export const downloadMcaddonFromZips = async (
  addonName: string,
  rpFile: File | null,
  bpFile: File | null
) => {
  const zip = new JSZip();

  if (rpFile) {
    // We don't want to include the path if the user drags a folder, just the file.
    zip.file(rpFile.name, rpFile);
  }
  if (bpFile) {
    zip.file(bpFile.name, bpFile);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  // Sanitize addonName for the filename
  const safeAddonName = addonName.replace(/[^a-zA-Z0-9_ -]/g, '').trim() || 'addon';
  link.download = `${safeAddonName}.mcaddon`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


export const filesToGenerativeParts = async (files: UploadedFile[]) => {
  const fileParts = await Promise.all(
    files.map(async (uploadedFile) => {
      const base64 = await fileToBase64(uploadedFile.file);
      return [
        { text: `This is the content of the file: ${uploadedFile.file.name}` },
        {
          inlineData: {
            mimeType: uploadedFile.file.type || 'application/octet-stream',
            data: base64,
          },
        }
      ];
    })
  );

  return fileParts.flat();
};