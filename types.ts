export interface GeneratedFile {
  path: string;
  content: string;
}

export interface UploadedFile {
  file: File;
  type: 'asset' | 'addon_file';
}

export interface AssetMapping {
  originalPath: string;
  newPath: string;
}
