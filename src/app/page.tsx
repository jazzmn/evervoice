"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import {
  SettingsDialog,
  RecordingControls,
  RecordingIndicator,
  WaveformCanvas,
  TranscriptionDisplay,
  HistorySidebar,
} from "@/components";
import { useAudioRecorder, useRecordingDuration, useFileStorage, useGlobalHotkey, useToast } from "@/hooks";
import { useSettingsStore, useRecordingStore, useHistoryStore, getSelectedRecording } from "@/stores";
import { Toaster } from "@/components/ui/toaster";
import { transcribeAudio, summarizeText, updateHistorySummary } from "@/lib/tauri-api";

/** Tab type for controlled tab switching */
type TabType = 'transcription' | 'summary';

export default function Home() {
  // Tab state for controlled switching
  const [activeTab, setActiveTab] = useState<TabType>('transcription');

  // Load settings on mount
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const apiKey = useSettingsStore((state) => state.settings.apiKey);
  const maxDuration = useSettingsStore((state) => state.settings.maxDuration);

  // History store
  const recordings = useHistoryStore((state) => state.recordings);
  const selectedRecordingId = useHistoryStore((state) => state.selectedRecordingId);
  const isHistoryLoading = useHistoryStore((state) => state.isLoading);
  const loadHistory = useHistoryStore((state) => state.loadHistory);
  const selectRecording = useHistoryStore((state) => state.selectRecording);
  const deleteRecording = useHistoryStore((state) => state.deleteRecording);
  const clearAllRecordings = useHistoryStore((state) => state.clearAllRecordings);
  const addRecordingToHistory = useHistoryStore((state) => state.addRecording);
  const selectedRecording = useHistoryStore((state) => getSelectedRecording(state));

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load history on app startup
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Audio recorder hook
  const {
    state: recorderState,
    mediaStream,
    audioResult,
    error: recorderError,
    permissionState,
    start,
    pause,
    resume,
    stop,
    reset,
    retryPermission,
  } = useAudioRecorder();

  // Recording store
  const recordingState = useRecordingStore((state) => state.recordingState);
  const setRecordingState = useRecordingStore((state) => state.setRecordingState);
  const setAudioResult = useRecordingStore((state) => state.setAudioResult);
  const filePath = useRecordingStore((state) => state.filePath);
  const setFilePath = useRecordingStore((state) => state.setFilePath);
  const transcription = useRecordingStore((state) => state.transcription);
  const setTranscription = useRecordingStore((state) => state.setTranscription);
  const transcriptionState = useRecordingStore((state) => state.transcriptionState);
  const setTranscriptionState = useRecordingStore((state) => state.setTranscriptionState);
  const transcriptionError = useRecordingStore((state) => state.transcriptionError);
  const setTranscriptionError = useRecordingStore((state) => state.setTranscriptionError);
  const resetForNewRecording = useRecordingStore((state) => state.resetForNewRecording);
  const clearTranscription = useRecordingStore((state) => state.clearTranscription);
  const resetElapsedSeconds = useRecordingStore((state) => state.resetElapsedSeconds);

  // Summary store
  const summary = useRecordingStore((state) => state.summary);
  const setSummary = useRecordingStore((state) => state.setSummary);
  const summaryState = useRecordingStore((state) => state.summaryState);
  const setSummaryState = useRecordingStore((state) => state.setSummaryState);
  const summaryError = useRecordingStore((state) => state.summaryError);
  const setSummaryError = useRecordingStore((state) => state.setSummaryError);
  const summarySourceText = useRecordingStore((state) => state.summarySourceText);

  // Toast for notifications
  const { toast } = useToast();

  // Track if we're currently processing to prevent duplicate calls
  const isProcessingRef = useRef(false);

  // File storage hook
  const { saveRecording, isSaving } = useFileStorage();

  // Duration tracking
  const {
    elapsedSeconds,
    formattedElapsed,
    formattedRemaining,
    showWarning,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
  } = useRecordingDuration(
    useCallback(() => {
      handleStop();
    }, [])
  );

  // Sync recorder state with store
  useEffect(() => {
    setRecordingState(recorderState);
  }, [recorderState, setRecordingState]);

  // Sync audio result with store
  useEffect(() => {
    if (audioResult) {
      setAudioResult(audioResult);
    }
  }, [audioResult, setAudioResult]);

  // Handle start recording - clears history selection and previous transcription
  const handleStart = useCallback(async () => {
    // Clear history selection when starting a new recording
    selectRecording(null);

    if (recordingState === "paused") {
      resume();
      resumeTimer();
    } else {
      // Reset all state for a fresh recording
      clearTranscription();
      setFilePath(null);
      setAudioResult(null);
      resetElapsedSeconds();
      // Reset tab to transcription when starting new recording
      setActiveTab('transcription');
      await start();
      startTimer();
    }
  }, [recordingState, selectRecording, resume, resumeTimer, clearTranscription, setFilePath, setAudioResult, resetElapsedSeconds, start, startTimer]);

  // Handle pause recording
  const handlePause = () => {
    pause();
    pauseTimer();
  };

  // Handle stop recording
  // Note: Don't save here - the useEffect below handles saving once audioResult is available
  const handleStop = useCallback(() => {
    stop();
    stopTimer();
  }, [stop, stopTimer]);

  // Set up global hotkey listener
  useGlobalHotkey(handleStart, handleStop);

  // Process recording: transcription + summarization
  const processRecording = useCallback(async (recordingFilePath: string, recordingDuration: number) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // Phase 1: Transcription
    setTranscriptionState('transcribing');
    setTranscriptionError(null);

    let transcribedText: string;

    try {
      const response = await transcribeAudio(recordingFilePath);

      if (!response.success || !response.text) {
        setTranscriptionError({
          type: response.errorType || 'unknown',
          message: response.errorMessage || 'Transcription failed',
          retryable: response.errorType === 'network_error' || response.errorType === 'rate_limit_exceeded',
        });
        setTranscriptionState('error');
        setRecordingState('idle');
        reset(); // Reset the audio recorder hook state
        isProcessingRef.current = false;
        return;
      }

      transcribedText = response.text;
      setTranscription(transcribedText);
      setTranscriptionState('success');

      // Save to history after successful transcription
      await addRecordingToHistory(recordingFilePath, recordingDuration, transcribedText);

    } catch (error) {
      setTranscriptionError({
        type: 'unknown',
        message: error instanceof Error ? error.message : 'Transcription failed',
        retryable: true,
      });
      setTranscriptionState('error');
      setRecordingState('idle');
      reset(); // Reset the audio recorder hook state
      isProcessingRef.current = false;
      return;
    }

    // Phase 2: Summarization
    setSummaryState('loading');
    setSummaryError(null);

    try {
      const generatedSummary = await summarizeText(transcribedText);

      // Store summary in the recording store
      setSummary(generatedSummary, transcribedText);
      setSummaryState('success');

      // Persist summary to history (selectedRecordingId was set by addRecordingToHistory)
      const currentSelectedId = useHistoryStore.getState().selectedRecordingId;
      if (currentSelectedId) {
        try {
          await updateHistorySummary(currentSelectedId, generatedSummary);
          await loadHistory(); // Refresh to get updated recording
        } catch (persistError) {
          // Summary was generated but couldn't be saved - not critical
          console.warn('Failed to persist summary to history:', persistError);
        }
      }

      toast({
        title: 'Processing complete',
        description: 'Transcription and summary have been generated.',
        variant: 'success',
      });

      // Switch to Summary tab
      setActiveTab('summary');

      // Reset recording state to idle so Start button is enabled again
      // Note: Don't reset filePath here - it would trigger the useEffect loop
      setRecordingState('idle');
      reset(); // Reset the audio recorder hook state

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to summarize text';
      setSummaryState('error');
      setSummaryError(message);
      toast({
        title: 'Summarization failed',
        description: message,
        variant: 'destructive',
      });
      // Still reset to idle so user can start new recording
      setRecordingState('idle');
      reset(); // Reset the audio recorder hook state
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    setTranscriptionState, setTranscriptionError, setTranscription,
    setSummaryState, setSummaryError, setSummary,
    setRecordingState, reset,
    addRecordingToHistory, loadHistory, toast
  ]);

  // Save recording when audioResult becomes available after stop, then auto-process
  useEffect(() => {
    const saveAndProcess = async () => {
      if (recorderState === "stopped" && audioResult?.blob && !filePath && !isSaving && !isProcessingRef.current) {
        const saved = await saveRecording(audioResult);
        if (saved) {
          setFilePath(saved.filePath);
          // Auto-start processing after saving
          processRecording(saved.filePath, elapsedSeconds);
        }
      }
    };
    saveAndProcess();
  }, [recorderState, audioResult, filePath, isSaving, saveRecording, setFilePath, processRecording, elapsedSeconds]);

  // Determine what transcription to display
  // Priority: selected history item > current recording transcription
  const displayTranscription = selectedRecording?.transcription ?? transcription;
  const displayTranscriptionState = selectedRecording
    ? (selectedRecording.transcription ? 'success' : 'idle')
    : transcriptionState;

  // Determine what summary to display
  // Priority: current summary in store > saved summary in selected recording
  // This ensures freshly generated summaries are shown immediately
  const hasFreshSummary = summary !== null && summaryState === 'success';
  const hasSelectedRecordingWithSummary = selectedRecording?.summary !== undefined && selectedRecording?.summary !== null;

  // Use fresh summary first (just generated), then fall back to persisted summary
  const displaySummary = hasFreshSummary
    ? summary
    : (hasSelectedRecordingWithSummary ? selectedRecording.summary : null);

  const displaySummaryState = hasFreshSummary
    ? summaryState
    : (hasSelectedRecordingWithSummary ? 'success' : summaryState);

  const displaySummaryError = hasFreshSummary
    ? summaryError
    : (hasSelectedRecordingWithSummary ? null : summaryError);

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8">
          {/* Header */}
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-nunito)] text-2xl font-extrabold text-[#F0E14A]">
                EverVoice
              </h1>
              <p className="text-sm text-zinc-400">
                Record, transcribe, and process!
              </p>
            </div>
            <SettingsDialog />
          </header>

          {/* Main Recording Panel */}
          <main className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            {/* Permission Error */}
            {permissionState === "denied" && (
              <div className="mb-4 rounded-lg bg-red-900/20 p-4">
                <p className="text-sm text-red-400">
                  Microphone access denied. Please allow microphone access to record.
                </p>
                <button
                  onClick={retryPermission}
                  className="mt-2 text-sm font-medium text-red-400 underline hover:no-underline"
                >
                  Retry Permission
                </button>
              </div>
            )}

            {/* Recorder Error */}
            {recorderError && (
              <div className="mb-4 rounded-lg bg-red-900/20 p-4">
                <p className="text-sm text-red-400">
                  {recorderError.message}
                </p>
              </div>
            )}

            {/* Waveform with Indicator */}
            <div className="relative mb-6">
              <WaveformCanvas
                mediaStream={mediaStream}
                state={recordingState}
                height={100}
                className="w-full"
              />
              <div className="absolute right-2 top-2">
                <RecordingIndicator state={recordingState} />
              </div>
            </div>

            {/* Duration Display */}
            <div className="mb-4 text-center">
              <span className="font-mono text-3xl font-semibold text-white">
                {formattedElapsed}
              </span>
              {showWarning && (
                <span className="ml-2 text-sm text-amber-400">
                  ({formattedRemaining} remaining)
                </span>
              )}
            </div>

            {/* Recording Controls */}
            <div className="mb-6">
              <RecordingControls
                state={recordingState}
                onStart={handleStart}
                onPause={handlePause}
                onStop={handleStop}
              />
            </div>

            {/* Saving indicator */}
            {recorderState === 'stopped' && isSaving && transcriptionState === 'idle' && (
              <div className="mb-4 flex items-center justify-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-[#F0E14A]" />
                <span className="text-sm text-zinc-300">Saving recording...</span>
              </div>
            )}

            {/* Transcription Result */}
            <TranscriptionDisplay
              transcriptionState={displayTranscriptionState}
              transcription={displayTranscription}
              error={selectedRecording ? null : transcriptionError}
              onRetry={selectedRecording ? undefined : undefined}
              summary={displaySummary}
              summaryState={displaySummaryState}
              summaryError={displaySummaryError}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </main>

          {/* Footer */}
          <footer className="mt-8 text-center text-xs text-zinc-600">
            EverVoice v0.1.0
          </footer>
        </div>
      </div>

      {/* History Sidebar (right side) */}
      <HistorySidebar
        recordings={recordings}
        selectedRecordingId={selectedRecordingId}
        isLoading={isHistoryLoading}
        onSelectRecording={selectRecording}
        onDeleteRecording={deleteRecording}
        onClearAll={clearAllRecordings}
      />

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
