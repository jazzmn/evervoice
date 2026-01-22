import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveRecording,
  deleteRecording,
  getRecordingsDirectory,
  ensureDirectoryExists,
  parseFileStorageError,
  isTauri,
} from './tauri-api';

// Mock the @tauri-apps/api/core module
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Get reference to the mocked invoke function
const getMockedInvoke = async () => {
  const module = await import('@tauri-apps/api/core');
  return vi.mocked(module.invoke);
};

/**
 * Create a mock Blob with arrayBuffer method for testing
 */
function createMockBlob(data: Uint8Array, type: string = 'audio/webm'): Blob {
  const blob = {
    size: data.length,
    type,
    arrayBuffer: async () => data.buffer,
    slice: () => blob as unknown as Blob,
    stream: () => new ReadableStream(),
    text: async () => '',
  } as unknown as Blob;
  return blob;
}

describe('File Storage API', () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    vi.clearAllMocks();
    // Store original window
    originalWindow = globalThis.window;
    // Mock Tauri environment
    // @ts-expect-error - Mocking window.__TAURI__
    globalThis.window = { __TAURI__: {} };
  });

  afterEach(() => {
    // Restore original window
    globalThis.window = originalWindow;
    vi.resetAllMocks();
  });

  describe('isTauri', () => {
    it('should return true when running in Tauri environment', () => {
      expect(isTauri()).toBe(true);
    });

    it('should return false when not running in Tauri environment', () => {
      // Remove __TAURI__ from window
      // @ts-expect-error - Mocking window without __TAURI__
      globalThis.window = {};
      expect(isTauri()).toBe(false);
    });
  });

  describe('getRecordingsDirectory', () => {
    it('should call invoke with correct command', async () => {
      const mockInvoke = await getMockedInvoke();
      const expectedPath = 'C:\\Users\\test\\AppData\\Roaming\\EverVoice\\recordings';
      mockInvoke.mockResolvedValue(expectedPath);

      const result = await getRecordingsDirectory();

      expect(mockInvoke).toHaveBeenCalledWith('get_recordings_directory', undefined);
      expect(result).toBe(expectedPath);
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should call invoke and return directory path', async () => {
      const mockInvoke = await getMockedInvoke();
      const expectedPath = 'C:\\Users\\test\\AppData\\Roaming\\EverVoice\\recordings';
      mockInvoke.mockResolvedValue(expectedPath);

      const result = await ensureDirectoryExists();

      expect(mockInvoke).toHaveBeenCalledWith('ensure_directory_exists', undefined);
      expect(result).toBe(expectedPath);
    });
  });

  describe('saveRecording', () => {
    it('should convert blob to array and call save_recording command', async () => {
      const mockInvoke = await getMockedInvoke();
      const expectedFilePath =
        'C:\\Users\\test\\AppData\\Roaming\\EverVoice\\recordings\\recording-2024-01-21T14-30-00-abc123.webm';
      mockInvoke.mockResolvedValue(expectedFilePath);

      // Create a mock blob with arrayBuffer method
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const blob = createMockBlob(testData);

      const result = await saveRecording(blob);

      expect(mockInvoke).toHaveBeenCalledWith('save_recording', {
        data: [1, 2, 3, 4, 5],
      });
      expect(result).toBe(expectedFilePath);
    });

    it('should handle empty blob', async () => {
      const mockInvoke = await getMockedInvoke();
      const expectedFilePath = '/path/to/recording.webm';
      mockInvoke.mockResolvedValue(expectedFilePath);

      // Create an empty mock blob
      const blob = createMockBlob(new Uint8Array([]));

      const result = await saveRecording(blob);

      expect(mockInvoke).toHaveBeenCalledWith('save_recording', {
        data: [],
      });
      expect(result).toBe(expectedFilePath);
    });
  });

  describe('deleteRecording', () => {
    it('should call delete_recording command with file path', async () => {
      const mockInvoke = await getMockedInvoke();
      mockInvoke.mockResolvedValue(undefined);

      const filePath =
        'C:\\Users\\test\\AppData\\Roaming\\EverVoice\\recordings\\recording-2024-01-21T14-30-00-abc123.webm';

      await deleteRecording(filePath);

      expect(mockInvoke).toHaveBeenCalledWith('delete_recording', { filePath });
    });
  });

  describe('parseFileStorageError', () => {
    it('should parse not_tauri error', () => {
      const error = new Error('Not running in Tauri environment');
      const result = parseFileStorageError(error);

      expect(result.type).toBe('not_tauri');
      expect(result.message).toContain('desktop app');
    });

    it('should parse directory creation error', () => {
      const error = new Error('Failed to create directory');
      const result = parseFileStorageError(error);

      expect(result.type).toBe('directory_creation_failed');
      expect(result.message).toContain('permissions');
    });

    it('should parse file write error', () => {
      const error = new Error('Failed to write recording file');
      const result = parseFileStorageError(error);

      expect(result.type).toBe('file_write_failed');
      expect(result.message).toContain('disk space');
    });

    it('should parse file delete error', () => {
      const error = new Error('Failed to delete recording');
      const result = parseFileStorageError(error);

      expect(result.type).toBe('file_delete_failed');
    });

    it('should handle unknown errors', () => {
      const error = new Error('Something unexpected happened');
      const result = parseFileStorageError(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Something unexpected happened');
    });

    it('should handle non-Error objects', () => {
      const result = parseFileStorageError('string error');

      expect(result.type).toBe('unknown');
      expect(result.message).toContain('unknown error');
    });
  });

  describe('error handling', () => {
    it('should throw error when not in Tauri environment', async () => {
      // Remove __TAURI__ from window
      // @ts-expect-error - Mocking window without __TAURI__
      globalThis.window = {};

      await expect(getRecordingsDirectory()).rejects.toThrow('Not running in Tauri environment');
    });

    it('should propagate backend errors', async () => {
      const mockInvoke = await getMockedInvoke();
      mockInvoke.mockRejectedValue(new Error('Failed to create directory: Permission denied'));

      await expect(ensureDirectoryExists()).rejects.toThrow('Permission denied');
    });
  });
});
