/**
 * Generates a SHA-256 hash from a series of strings and ArrayBuffers to be used as a cache key.
 */
export const generateCacheKey = async (parts: (string | ArrayBuffer)[]): Promise<string> => {
    // Create a new Uint8Array to hold all the data
    const totalLength = parts.reduce((acc, part) => acc + (typeof part === 'string' ? new TextEncoder().encode(part).length : part.byteLength), 0);
    const combined = new Uint8Array(totalLength);

    let offset = 0;
    for (const part of parts) {
        if (typeof part === 'string') {
            const encoded = new TextEncoder().encode(part);
            combined.set(encoded, offset);
            offset += encoded.length;
        } else {
            combined.set(new Uint8Array(part), offset);
            offset += part.byteLength;
        }
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

/**
 * Retrieves and parses a JSON item from sessionStorage.
 */
export const getFromCache = <T>(key: string): T | null => {
    try {
        const item = sessionStorage.getItem(key);
        if (!item) return null;
        return JSON.parse(item) as T;
    } catch (error) {
        console.error(`Failed to retrieve or parse cache for key "${key}"`, error);
        return null;
    }
};

/**
 * Stringifies and stores a JSON item in sessionStorage.
 */
export const setInCache = <T>(key: string, data: T): void => {
    try {
        const item = JSON.stringify(data);
        sessionStorage.setItem(key, item);
    } catch (error) {
        console.error(`Failed to set cache for key "${key}"`, error);
        // This can happen if storage is full
    }
};
