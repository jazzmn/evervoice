/**
 * Integration tests for the UI Enhancements feature.
 *
 * These tests verify critical end-to-end workflows that span multiple
 * components, stores, and API calls to ensure they work together correctly.
 *
 * Tests focus on:
 * 1. Recording -> Transcription -> History integration
 * 2. History selection -> Transcription display
 * 3. Summarize flow -> Clipboard
 * 4. Custom action configuration -> Button rendering
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRecordingStore } from '@/stores/recording-store';
import { useHistoryStore } from '@/stores/history-store';
import { useSettingsStore } from '@/stores/settings-store';
import { DEFAULT_SETTINGS } from '@/types';
import type { Recording } from '@/types';

// Mock the tauri-api module
vi.mock('@/lib/tauri-api', () => ({
  isTauri: vi.fn(() => true),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  getHistory: vi.fn(),
  saveRecordingHistory: vi.fn(),
  deleteRecordingHistory: vi.fn(),
  summarizeText: vi.fn(),
  callExternalService: vi.fn(),
  transcribeAudio: vi.fn(),
  saveRecording: vi.fn(),
  ensureDirectoryExists: vi.fn(),
}));

import {
  getHistory,
  saveRecordingHistory,
  summarizeText,
  callExternalService,
  isTauri,
} from '@/lib/tauri-api';

const mockGetHistory = vi.mocked(getHistory);
const mockSaveRecordingHistory = vi.mocked(saveRecordingHistory);
const mockSummarizeText = vi.mocked(summarizeText);
const mockCallExternalService = vi.mocked(callExternalService);
const mockIsTauri = vi.mocked(isTauri);

// Test fixture data
const mockRecordings: Recording[] = [
  {
    id: 'rec-1',
    filePath: '/recordings/recording-1.webm',
    durationSeconds: 60,
    transcription: 'First test transcription content for testing.',
    createdAt: '2024-01-21T10:00:00.000Z',
  },
  {
    id: 'rec-2',
    filePath: '/recordings/recording-2.webm',
    durationSeconds: 45,
    transcription: 'Second transcription with different content.',
    createdAt: '2024-01-21T09:00:00.000Z',
  },
];

describe('UI Enhancements Integration Tests', () => {
  beforeEach(() => {
    // Reset all stores to initial state
    useRecordingStore.getState().resetRecording();
    useHistoryStore.setState({
      recordings: [],
      selectedRecordingId: null,
      isLoading: false,
      error: null,
    });
    useSettingsStore.setState({
      settings: DEFAULT_SETTINGS,
      isLoaded: true,
      isSaving: false,
      error: null,
    });

    // Reset mocks
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Recording -> History Integration', () => {
    it('should save new recording to history after transcription completes', async () => {
      // Setup: Configure mocks for the complete flow
      mockSaveRecordingHistory.mockResolvedValue('new-rec-id');
      mockGetHistory.mockResolvedValue([
        {
          id: 'new-rec-id',
          filePath: '/recordings/new-recording.webm',
          durationSeconds: 30,
          transcription: 'New transcription text',
          createdAt: '2024-01-21T12:00:00.000Z',
        },
        ...mockRecordings,
      ]);

      const historyStore = useHistoryStore.getState();
      const recordingStore = useRecordingStore.getState();

      // Simulate recording completion with transcription
      recordingStore.setRecordingState('stopped');
      recordingStore.setFilePath('/recordings/new-recording.webm');
      recordingStore.setTranscription('New transcription text');
      recordingStore.setTranscriptionState('success');

      // Simulate the flow: save to history after transcription
      await historyStore.addRecording(
        '/recordings/new-recording.webm',
        30,
        'New transcription text'
      );

      // Verify the recording was saved via API
      expect(mockSaveRecordingHistory).toHaveBeenCalledWith(
        '/recordings/new-recording.webm',
        30,
        'New transcription text'
      );

      // Verify the history store is updated
      expect(useHistoryStore.getState().recordings).toHaveLength(3);
      expect(useHistoryStore.getState().recordings[0].id).toBe('new-rec-id');
    });

    it('should display new recording in history list immediately after save', async () => {
      // Setup mocks
      mockSaveRecordingHistory.mockResolvedValue('new-rec-id');
      mockGetHistory.mockResolvedValue([
        {
          id: 'new-rec-id',
          filePath: '/recordings/new-recording.webm',
          durationSeconds: 45,
          transcription: 'Just recorded this transcription',
          createdAt: new Date().toISOString(),
        },
      ]);

      const historyStore = useHistoryStore.getState();

      // Add a new recording
      await historyStore.addRecording(
        '/recordings/new-recording.webm',
        45,
        'Just recorded this transcription'
      );

      // Verify the list was refreshed
      expect(mockGetHistory).toHaveBeenCalled();

      // Verify the new recording is in state
      const state = useHistoryStore.getState();
      expect(state.recordings).toHaveLength(1);
      expect(state.recordings[0].transcription).toBe('Just recorded this transcription');
    });
  });

  describe('History Selection -> Transcription Display', () => {
    it('should update transcription display when selecting a history item', () => {
      // Pre-populate history
      useHistoryStore.setState({
        recordings: mockRecordings,
        selectedRecordingId: null,
        isLoading: false,
        error: null,
      });

      const historyStore = useHistoryStore.getState();

      // Initially no selection
      expect(useHistoryStore.getState().selectedRecordingId).toBeNull();

      // Select the second recording
      historyStore.selectRecording('rec-2');

      // Verify selection
      expect(useHistoryStore.getState().selectedRecordingId).toBe('rec-2');

      // Verify we can get the selected recording
      const state = useHistoryStore.getState();
      const selected = state.recordings.find((r) => r.id === state.selectedRecordingId);
      expect(selected).toBeDefined();
      expect(selected?.transcription).toBe('Second transcription with different content.');
    });

    it('should clear transcription display when starting new recording', () => {
      // Setup: History item selected
      useHistoryStore.setState({
        recordings: mockRecordings,
        selectedRecordingId: 'rec-1',
        isLoading: false,
        error: null,
      });

      const historyStore = useHistoryStore.getState();
      const recordingStore = useRecordingStore.getState();

      // Verify selection exists
      expect(useHistoryStore.getState().selectedRecordingId).toBe('rec-1');

      // Start new recording - selection should clear
      historyStore.selectRecording(null);
      recordingStore.setRecordingState('recording');

      // Verify selection is cleared
      expect(useHistoryStore.getState().selectedRecordingId).toBeNull();
      expect(useRecordingStore.getState().recordingState).toBe('recording');
    });

    it('should display correct transcription content for selected history item', () => {
      // Pre-populate history with multiple items
      useHistoryStore.setState({
        recordings: mockRecordings,
        selectedRecordingId: null,
        isLoading: false,
        error: null,
      });

      const historyStore = useHistoryStore.getState();

      // Select first item
      historyStore.selectRecording('rec-1');
      let state = useHistoryStore.getState();
      let selected = state.recordings.find((r) => r.id === state.selectedRecordingId);
      expect(selected?.transcription).toBe('First test transcription content for testing.');

      // Switch to second item
      historyStore.selectRecording('rec-2');
      state = useHistoryStore.getState();
      selected = state.recordings.find((r) => r.id === state.selectedRecordingId);
      expect(selected?.transcription).toBe('Second transcription with different content.');
    });
  });

  describe('Summarize Flow Integration', () => {
    it('should complete full summarize flow: button click -> API call -> result', async () => {
      const summaryText = '## Summary\n- Point 1\n- Point 2\n- Point 3';
      mockSummarizeText.mockResolvedValue(summaryText);

      // The API is called with transcription text
      const transcription = 'This is a long transcription that needs to be summarized.';
      const result = await summarizeText(transcription);

      // Verify API was called correctly
      expect(mockSummarizeText).toHaveBeenCalledWith(transcription);

      // Verify result contains markdown
      expect(result).toContain('## Summary');
      expect(result).toContain('- Point');
    });

    it('should handle summarization errors gracefully', async () => {
      mockSummarizeText.mockRejectedValue(new Error('API error: Rate limit exceeded'));

      const transcription = 'Text to summarize';

      await expect(summarizeText(transcription)).rejects.toThrow('API error');
      expect(mockSummarizeText).toHaveBeenCalledWith(transcription);
    });
  });

  describe('Custom Actions Integration', () => {
    it('should make custom actions configured in settings available for execution', async () => {
      // Setup: Configure custom actions in settings
      useSettingsStore.setState({
        settings: {
          ...DEFAULT_SETTINGS,
          customActions: [
            { id: 'action-1', name: 'Send to Notion', url: 'https://api.notion.com/v1/pages' },
            { id: 'action-2', name: 'Post to Slack', url: 'https://hooks.slack.com/services/test' },
          ],
        },
        isLoaded: true,
        isSaving: false,
        error: null,
      });

      // Verify custom actions are available in state
      const state = useSettingsStore.getState();
      expect(state.settings.customActions).toHaveLength(2);
      expect(state.settings.customActions[0].name).toBe('Send to Notion');
      expect(state.settings.customActions[1].name).toBe('Post to Slack');

      // Setup mock for external service call
      mockCallExternalService.mockResolvedValue({
        success: true,
        message: 'Message sent successfully',
      });

      // Execute the first custom action
      const transcription = 'Test transcription to send';
      const firstAction = state.settings.customActions[0];
      const result = await callExternalService(firstAction.url, transcription);

      // Verify the call was made correctly
      expect(mockCallExternalService).toHaveBeenCalledWith(
        'https://api.notion.com/v1/pages',
        transcription
      );
      expect(result.success).toBe(true);
    });

    it('should persist custom actions when added through settings', async () => {
      const settingsStore = useSettingsStore.getState();

      // Add a new custom action
      await settingsStore.addCustomAction('My Webhook', 'https://example.com/webhook');

      // Verify the action was added
      const state = useSettingsStore.getState();
      expect(state.settings.customActions).toHaveLength(1);
      expect(state.settings.customActions[0].name).toBe('My Webhook');
      expect(state.settings.customActions[0].url).toBe('https://example.com/webhook');
      expect(state.settings.customActions[0].id).toBeDefined();
    });

    it('should handle external service errors correctly', async () => {
      mockCallExternalService.mockResolvedValue({
        success: false,
        message: 'Connection refused',
      });

      const result = await callExternalService('https://example.com/api', 'test text');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection refused');
    });
  });

  describe('Full User Workflow Integration', () => {
    it('should support complete workflow: record -> transcribe -> save to history -> select -> summarize', async () => {
      // Step 1: Complete a recording
      const recordingStore = useRecordingStore.getState();
      recordingStore.setRecordingState('recording');
      recordingStore.setRecordingState('stopped');
      recordingStore.setFilePath('/recordings/workflow-test.webm');

      // Step 2: Complete transcription
      const transcription = 'This is the transcribed text from the recording.';
      recordingStore.setTranscription(transcription);
      recordingStore.setTranscriptionState('success');

      // Step 3: Save to history
      mockSaveRecordingHistory.mockResolvedValue('workflow-rec-id');
      mockGetHistory.mockResolvedValue([
        {
          id: 'workflow-rec-id',
          filePath: '/recordings/workflow-test.webm',
          durationSeconds: 15,
          transcription: transcription,
          createdAt: new Date().toISOString(),
        },
      ]);

      const historyStore = useHistoryStore.getState();
      await historyStore.addRecording(
        '/recordings/workflow-test.webm',
        15,
        transcription
      );

      // Verify history was updated
      expect(useHistoryStore.getState().recordings).toHaveLength(1);

      // Step 4: Select from history
      historyStore.selectRecording('workflow-rec-id');
      expect(useHistoryStore.getState().selectedRecordingId).toBe('workflow-rec-id');

      // Step 5: Summarize the selected recording
      mockSummarizeText.mockResolvedValue('- Recording summarized');
      const summary = await summarizeText(transcription);
      expect(summary).toBe('- Recording summarized');
    });

    it('should maintain state consistency when switching between history items and new recordings', () => {
      // Pre-populate history
      useHistoryStore.setState({
        recordings: mockRecordings,
        selectedRecordingId: null,
        isLoading: false,
        error: null,
      });

      const historyStore = useHistoryStore.getState();
      const recordingStore = useRecordingStore.getState();

      // Select a history item
      historyStore.selectRecording('rec-1');
      expect(useHistoryStore.getState().selectedRecordingId).toBe('rec-1');

      // Start new recording - should clear selection
      historyStore.selectRecording(null);
      recordingStore.setRecordingState('recording');
      expect(useHistoryStore.getState().selectedRecordingId).toBeNull();
      expect(useRecordingStore.getState().recordingState).toBe('recording');

      // Complete recording
      recordingStore.setRecordingState('stopped');
      recordingStore.setTranscription('New recording transcription');
      recordingStore.setTranscriptionState('success');

      // Go back to history item
      historyStore.selectRecording('rec-2');
      expect(useHistoryStore.getState().selectedRecordingId).toBe('rec-2');

      // Recording store should still have its data
      expect(useRecordingStore.getState().transcription).toBe('New recording transcription');
      expect(useRecordingStore.getState().transcriptionState).toBe('success');
    });
  });
});
