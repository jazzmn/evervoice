import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useHistoryStore, getSelectedRecording } from './history-store';
import type { Recording } from '@/types';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  isTauri: vi.fn(() => true),
  getHistory: vi.fn(),
  saveRecordingHistory: vi.fn(),
  deleteRecordingHistory: vi.fn(),
}));

// Import mocked functions for assertions
import {
  getHistory,
  saveRecordingHistory,
  deleteRecordingHistory,
  isTauri,
} from '@/lib/tauri-api';
const mockGetHistory = vi.mocked(getHistory);
const mockSaveRecordingHistory = vi.mocked(saveRecordingHistory);
const mockDeleteRecordingHistory = vi.mocked(deleteRecordingHistory);
const mockIsTauri = vi.mocked(isTauri);

// Sample test data
const mockRecordings: Recording[] = [
  {
    id: 'uuid-1',
    filePath: '/path/to/recording1.webm',
    durationSeconds: 60,
    transcription: 'First transcription text',
    createdAt: '2024-01-15T10:30:00.000Z',
  },
  {
    id: 'uuid-2',
    filePath: '/path/to/recording2.webm',
    durationSeconds: 120,
    transcription: 'Second transcription text',
    createdAt: '2024-01-15T09:00:00.000Z',
  },
];

describe('History Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useHistoryStore.setState({
      recordings: [],
      selectedRecordingId: null,
      playingRecordingId: null,
      isLoading: false,
      error: null,
    });

    // Clear all mocks
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('loadHistory', () => {
    it('should populate recordings array when loadHistory is called', async () => {
      mockGetHistory.mockResolvedValue(mockRecordings);

      await useHistoryStore.getState().loadHistory();

      expect(mockGetHistory).toHaveBeenCalled();
      expect(useHistoryStore.getState().recordings).toEqual(mockRecordings);
      expect(useHistoryStore.getState().isLoading).toBe(false);
    });
  });

  describe('addRecording', () => {
    it('should add new record to state and persist to store', async () => {
      mockSaveRecordingHistory.mockResolvedValue('new-uuid');
      mockGetHistory.mockResolvedValue([
        {
          id: 'new-uuid',
          filePath: '/path/to/new.webm',
          durationSeconds: 45,
          transcription: 'New transcription',
          createdAt: '2024-01-15T12:00:00.000Z',
        },
        ...mockRecordings,
      ]);

      await useHistoryStore.getState().addRecording(
        '/path/to/new.webm',
        45,
        'New transcription'
      );

      expect(mockSaveRecordingHistory).toHaveBeenCalledWith(
        '/path/to/new.webm',
        45,
        'New transcription'
      );
      // After adding, loadHistory is called to refresh the list
      expect(mockGetHistory).toHaveBeenCalled();
      expect(useHistoryStore.getState().recordings).toHaveLength(3);
    });
  });

  describe('selectRecording', () => {
    it('should update selectedRecordingId when selectRecording is called', () => {
      useHistoryStore.setState({ recordings: mockRecordings });

      useHistoryStore.getState().selectRecording('uuid-1');

      expect(useHistoryStore.getState().selectedRecordingId).toBe('uuid-1');

      // Verify getSelectedRecording helper works
      const state = useHistoryStore.getState();
      const selected = getSelectedRecording(state);
      expect(selected).toEqual(mockRecordings[0]);
    });
  });

  describe('deleteRecording', () => {
    it('should remove record from state and store', async () => {
      useHistoryStore.setState({
        recordings: mockRecordings,
        selectedRecordingId: 'uuid-1',
      });
      mockDeleteRecordingHistory.mockResolvedValue(undefined);
      mockGetHistory.mockResolvedValue([mockRecordings[1]]);

      await useHistoryStore.getState().deleteRecording('uuid-1');

      expect(mockDeleteRecordingHistory).toHaveBeenCalledWith('uuid-1');
      // Selection should be cleared since the deleted recording was selected
      expect(useHistoryStore.getState().selectedRecordingId).toBeNull();
      // List should be refreshed
      expect(useHistoryStore.getState().recordings).toHaveLength(1);
      expect(useHistoryStore.getState().recordings[0].id).toBe('uuid-2');
    });
  });

  describe('playback state management', () => {
    it('should set playingRecordingId when startPlayback is called', () => {
      useHistoryStore.setState({ recordings: mockRecordings });

      useHistoryStore.getState().startPlayback('uuid-1');

      expect(useHistoryStore.getState().playingRecordingId).toBe('uuid-1');
    });

    it('should reset playingRecordingId to null when stopPlayback is called', () => {
      useHistoryStore.setState({
        recordings: mockRecordings,
        playingRecordingId: 'uuid-1',
      });

      useHistoryStore.getState().stopPlayback();

      expect(useHistoryStore.getState().playingRecordingId).toBeNull();
    });

    it('should replace existing playingRecordingId when startPlayback is called with new id', () => {
      useHistoryStore.setState({
        recordings: mockRecordings,
        playingRecordingId: 'uuid-1',
      });

      useHistoryStore.getState().startPlayback('uuid-2');

      expect(useHistoryStore.getState().playingRecordingId).toBe('uuid-2');
    });
  });
});
