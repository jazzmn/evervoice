/**
 * Tests for summary state management in the recording store.
 *
 * These tests verify the summary-related actions and state transitions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useRecordingStore } from '@/stores/recording-store';

describe('Recording Store Summary State', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useRecordingStore.getState().resetRecording();
  });

  it('setSummary action correctly updates summary', () => {
    const store = useRecordingStore.getState();
    const testSummary = '## Summary\n- Point 1\n- Point 2';

    // Initially summary should be null
    expect(store.summary).toBeNull();

    // Set summary
    store.setSummary(testSummary);

    // Verify summary is updated
    const updatedState = useRecordingStore.getState();
    expect(updatedState.summary).toBe(testSummary);

    // Test clearing summary
    store.setSummary(null);
    const clearedState = useRecordingStore.getState();
    expect(clearedState.summary).toBeNull();
  });

  it('setSummaryState action transitions between states correctly', () => {
    const store = useRecordingStore.getState();

    // Initial state should be idle
    expect(store.summaryState).toBe('idle');

    // Transition to loading
    store.setSummaryState('loading');
    expect(useRecordingStore.getState().summaryState).toBe('loading');

    // Transition to success
    store.setSummaryState('success');
    expect(useRecordingStore.getState().summaryState).toBe('success');

    // Transition to error
    store.setSummaryState('error');
    expect(useRecordingStore.getState().summaryState).toBe('error');

    // Transition back to idle
    store.setSummaryState('idle');
    expect(useRecordingStore.getState().summaryState).toBe('idle');
  });

  it('clearSummary resets summary and summaryState to initial values', () => {
    const store = useRecordingStore.getState();

    // Set up some summary state
    store.setSummary('## Test Summary');
    store.setSummaryState('success');
    store.setSummaryError('Some error message');

    // Verify state is set
    let state = useRecordingStore.getState();
    expect(state.summary).toBe('## Test Summary');
    expect(state.summaryState).toBe('success');
    expect(state.summaryError).toBe('Some error message');

    // Clear summary
    store.clearSummary();

    // Verify all summary fields are reset
    state = useRecordingStore.getState();
    expect(state.summary).toBeNull();
    expect(state.summaryState).toBe('idle');
    expect(state.summaryError).toBeNull();
  });

  it('resetForNewRecording clears summary state', () => {
    const store = useRecordingStore.getState();

    // Set up transcription and summary state
    store.setTranscription('Test transcription');
    store.setTranscriptionState('success');
    store.setSummary('## Test Summary');
    store.setSummaryState('success');

    // Reset for new recording
    store.resetForNewRecording();

    // Transcription should be preserved
    const state = useRecordingStore.getState();
    expect(state.transcription).toBe('Test transcription');
    expect(state.transcriptionState).toBe('success');

    // Summary should be cleared
    expect(state.summary).toBeNull();
    expect(state.summaryState).toBe('idle');
    expect(state.summaryError).toBeNull();
  });

  it('clearTranscription also clears summary state', () => {
    const store = useRecordingStore.getState();

    // Set up transcription and summary state
    store.setTranscription('Test transcription');
    store.setTranscriptionState('success');
    store.setSummary('## Test Summary');
    store.setSummaryState('success');

    // Clear transcription
    store.clearTranscription();

    // Both transcription and summary should be cleared
    const state = useRecordingStore.getState();
    expect(state.transcription).toBeNull();
    expect(state.transcriptionState).toBe('idle');
    expect(state.summary).toBeNull();
    expect(state.summaryState).toBe('idle');
    expect(state.summaryError).toBeNull();
  });
});
