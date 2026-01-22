import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranscribeButton } from './transcribe-button';
import { TranscriptionDisplay } from './transcription-display';

describe('TranscribeButton', () => {
  it('should be disabled until recording is stopped and file exists', () => {
    const onTranscribe = vi.fn();

    // Test: disabled when idle
    const { rerender } = render(
      <TranscribeButton
        recordingState="idle"
        transcriptionState="idle"
        hasFile={false}
        onTranscribe={onTranscribe}
      />
    );
    expect(screen.getByRole('button', { name: /transcribe/i })).toBeDisabled();

    // Test: disabled when recording
    rerender(
      <TranscribeButton
        recordingState="recording"
        transcriptionState="idle"
        hasFile={false}
        onTranscribe={onTranscribe}
      />
    );
    expect(screen.getByRole('button', { name: /transcribe/i })).toBeDisabled();

    // Test: disabled when paused
    rerender(
      <TranscribeButton
        recordingState="paused"
        transcriptionState="idle"
        hasFile={false}
        onTranscribe={onTranscribe}
      />
    );
    expect(screen.getByRole('button', { name: /transcribe/i })).toBeDisabled();

    // Test: disabled when stopped but no file
    rerender(
      <TranscribeButton
        recordingState="stopped"
        transcriptionState="idle"
        hasFile={false}
        onTranscribe={onTranscribe}
      />
    );
    expect(screen.getByRole('button', { name: /transcribe/i })).toBeDisabled();

    // Test: enabled when stopped and file exists
    rerender(
      <TranscribeButton
        recordingState="stopped"
        transcriptionState="idle"
        hasFile={true}
        onTranscribe={onTranscribe}
      />
    );
    expect(screen.getByRole('button', { name: /transcribe/i })).not.toBeDisabled();
  });

  it('should display loading state during API call', () => {
    const onTranscribe = vi.fn();

    render(
      <TranscribeButton
        recordingState="stopped"
        transcriptionState="transcribing"
        hasFile={true}
        onTranscribe={onTranscribe}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Transcribing...');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('should call onTranscribe when clicked and enabled', async () => {
    const onTranscribe = vi.fn();

    render(
      <TranscribeButton
        recordingState="stopped"
        transcriptionState="idle"
        hasFile={true}
        onTranscribe={onTranscribe}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /transcribe/i }));
    expect(onTranscribe).toHaveBeenCalledTimes(1);
  });
});

describe('TranscriptionDisplay', () => {
  it('should display transcription text on success', () => {
    render(
      <TranscriptionDisplay
        transcriptionState="success"
        transcription="Hello, this is a test transcription."
        error={null}
      />
    );

    expect(screen.getByText('Transcription')).toBeInTheDocument();
    expect(
      screen.getByText('Hello, this is a test transcription.')
    ).toBeInTheDocument();
  });

  it('should display error message with user-friendly text', () => {
    render(
      <TranscriptionDisplay
        transcriptionState="error"
        transcription={null}
        error={{
          type: 'network_error',
          message:
            'Transcription failed - please try again. Check your internet connection.',
          retryable: true,
        }}
      />
    );

    expect(screen.getByText('Transcription Failed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Transcription failed - please try again. Check your internet connection.'
      )
    ).toBeInTheDocument();
  });

  it('should show retry button for retryable errors', async () => {
    const onRetry = vi.fn();

    render(
      <TranscriptionDisplay
        transcriptionState="error"
        transcription={null}
        error={{
          type: 'network_error',
          message: 'Network error occurred',
          retryable: true,
        }}
        onRetry={onRetry}
      />
    );

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    await userEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not show retry button for non-retryable errors', () => {
    render(
      <TranscriptionDisplay
        transcriptionState="error"
        transcription={null}
        error={{
          type: 'api_key_not_configured',
          message: 'API key not configured',
          retryable: false,
        }}
        onRetry={vi.fn()}
      />
    );

    expect(
      screen.queryByRole('button', { name: /try again/i })
    ).not.toBeInTheDocument();
  });

  it('should render nothing when idle or transcribing', () => {
    const { container, rerender } = render(
      <TranscriptionDisplay
        transcriptionState="idle"
        transcription={null}
        error={null}
      />
    );
    expect(container.firstChild).toBeNull();

    rerender(
      <TranscriptionDisplay
        transcriptionState="transcribing"
        transcription={null}
        error={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
