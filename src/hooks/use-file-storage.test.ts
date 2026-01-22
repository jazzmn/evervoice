import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileStorage } from './use-file-storage';
import type { AudioRecordingResult } from '@/types';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  isTauri: vi.fn(() => true),
  saveRecording: vi.fn(),
  deleteRecording: vi.fn(),
  ensureDirectoryExists: vi.fn(),
  parseFileStorageError: vi.fn((err) => ({
    type: 'unknown',
    message: err instanceof Error ? err.message : 'Unknown error',
  })),
}));

// Import mocked functions for assertions
import {
  isTauri,
  saveRecording as saveRecordingApi,
  deleteRecording as deleteRecordingApi,
  ensureDirectoryExists,
  parseFileStorageError,
} from '@/lib/tauri-api';

const mockIsTauri = vi.mocked(isTauri);
const mockSaveRecording = vi.mocked(saveRecordingApi);
const mockDeleteRecording = vi.mocked(deleteRecordingApi);
const mockEnsureDirectoryExists = vi.mocked(ensureDirectoryExists);
const mockParseFileStorageError = vi.mocked(parseFileStorageError);

describe('useFileStorage', () => {
  // Create a mock audio recording result
  const createMockRecording = (): AudioRecordingResult => ({
    blob: new Blob(['test audio data'], { type: 'audio/webm' }),
    mimeType: 'audio/webm',
    duration: 5000,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockEnsureDirectoryExists.mockResolvedValue('/path/to/recordings');
    mockParseFileStorageError.mockImplementation((err) => ({
      type: 'unknown',
      message: err instanceof Error ? err.message : 'Unknown error',
    }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useFileStorage());

      expect(result.current.isSaving).toBe(false);
      expect(result.current.isDeleting).toBe(false);
      expect(result.current.savedRecording).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('saveRecording', () => {
    it('should save recording and return saved recording with file path', async () => {
      const expectedFilePath = '/path/to/recordings/recording-2024-01-21T14-30-00-abc123.webm';
      mockSaveRecording.mockResolvedValue(expectedFilePath);

      const { result } = renderHook(() => useFileStorage());
      const mockRecording = createMockRecording();

      let saved: Awaited<ReturnType<typeof result.current.saveRecording>>;
      await act(async () => {
        saved = await result.current.saveRecording(mockRecording);
      });

      expect(mockEnsureDirectoryExists).toHaveBeenCalled();
      expect(mockSaveRecording).toHaveBeenCalledWith(mockRecording.blob);
      expect(saved).not.toBeNull();
      expect(saved?.filePath).toBe(expectedFilePath);
      expect(saved?.mimeType).toBe('audio/webm');
      expect(saved?.duration).toBe(5000);
      expect(saved?.savedAt).toBeDefined();
      expect(result.current.savedRecording).toEqual(saved);
    });

    it('should set isSaving to true during save operation', async () => {
      let resolveSave: (value: string) => void;
      const savePromise = new Promise<string>((resolve) => {
        resolveSave = resolve;
      });
      mockSaveRecording.mockReturnValue(savePromise);

      const { result } = renderHook(() => useFileStorage());

      // Start saving
      act(() => {
        result.current.saveRecording(createMockRecording());
      });

      // Should be saving
      await waitFor(() => {
        expect(result.current.isSaving).toBe(true);
      });

      // Complete the save
      await act(async () => {
        resolveSave!('/path/to/file.webm');
        await savePromise;
      });

      // Should be done saving
      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });
    });

    it('should handle save errors gracefully', async () => {
      const errorMessage = 'Failed to write recording file';
      mockSaveRecording.mockRejectedValue(new Error(errorMessage));
      mockParseFileStorageError.mockReturnValue({
        type: 'file_write_failed',
        message: 'Failed to save recording. Please check available disk space.',
      });

      const { result } = renderHook(() => useFileStorage());

      let saved: Awaited<ReturnType<typeof result.current.saveRecording>>;
      await act(async () => {
        saved = await result.current.saveRecording(createMockRecording());
      });

      expect(saved).toBeNull();
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.type).toBe('file_write_failed');
      expect(result.current.savedRecording).toBeNull();
    });

    it('should return error when not in Tauri environment', async () => {
      mockIsTauri.mockReturnValue(false);

      const { result } = renderHook(() => useFileStorage());

      let saved: Awaited<ReturnType<typeof result.current.saveRecording>>;
      await act(async () => {
        saved = await result.current.saveRecording(createMockRecording());
      });

      expect(saved).toBeNull();
      expect(result.current.error?.type).toBe('not_tauri');
      expect(mockSaveRecording).not.toHaveBeenCalled();
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording and clear savedRecording if it matches', async () => {
      const filePath = '/path/to/recordings/recording-2024-01-21T14-30-00-abc123.webm';
      mockSaveRecording.mockResolvedValue(filePath);
      mockDeleteRecording.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFileStorage());

      // First save a recording
      await act(async () => {
        await result.current.saveRecording(createMockRecording());
      });

      expect(result.current.savedRecording).not.toBeNull();

      // Now delete it
      let success: boolean;
      await act(async () => {
        success = await result.current.deleteRecording(filePath);
      });

      expect(success!).toBe(true);
      expect(mockDeleteRecording).toHaveBeenCalledWith(filePath);
      expect(result.current.savedRecording).toBeNull();
    });

    it('should return true in non-Tauri environment (no-op)', async () => {
      mockIsTauri.mockReturnValue(false);

      const { result } = renderHook(() => useFileStorage());

      let success: boolean;
      await act(async () => {
        success = await result.current.deleteRecording('/some/path.webm');
      });

      expect(success!).toBe(true);
      expect(mockDeleteRecording).not.toHaveBeenCalled();
    });

    it('should handle delete errors gracefully', async () => {
      mockDeleteRecording.mockRejectedValue(new Error('Permission denied'));
      mockParseFileStorageError.mockReturnValue({
        type: 'file_delete_failed',
        message: 'Failed to delete recording file.',
      });

      const { result } = renderHook(() => useFileStorage());

      let success: boolean;
      await act(async () => {
        success = await result.current.deleteRecording('/path/to/file.webm');
      });

      expect(success!).toBe(false);
      expect(result.current.error?.type).toBe('file_delete_failed');
    });
  });

  describe('clearError', () => {
    it('should clear the error state', async () => {
      mockSaveRecording.mockRejectedValue(new Error('Test error'));
      mockParseFileStorageError.mockReturnValue({
        type: 'unknown',
        message: 'Test error',
      });

      const { result } = renderHook(() => useFileStorage());

      // Trigger an error
      await act(async () => {
        await result.current.saveRecording(createMockRecording());
      });

      expect(result.current.error).not.toBeNull();

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('clearSavedRecording', () => {
    it('should clear the saved recording state', async () => {
      mockSaveRecording.mockResolvedValue('/path/to/file.webm');

      const { result } = renderHook(() => useFileStorage());

      // Save a recording
      await act(async () => {
        await result.current.saveRecording(createMockRecording());
      });

      expect(result.current.savedRecording).not.toBeNull();

      // Clear it
      act(() => {
        result.current.clearSavedRecording();
      });

      expect(result.current.savedRecording).toBeNull();
    });
  });
});
