import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordingControls } from './recording-controls';
import { RecordingIndicator } from './recording-indicator';

describe('RecordingControls', () => {
  describe('Start/Resume button', () => {
    it('should show "Start" label when state is idle and call onStart when clicked', async () => {
      const onStart = vi.fn();
      render(
        <RecordingControls
          state="idle"
          onStart={onStart}
          onPause={vi.fn()}
          onStop={vi.fn()}
        />
      );

      const startButton = screen.getByRole('button', { name: /start/i });
      expect(startButton).toBeInTheDocument();
      expect(startButton).toHaveTextContent('Start');
      expect(startButton).not.toBeDisabled();

      await userEvent.click(startButton);
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('should show "Resume" label when state is paused', () => {
      render(
        <RecordingControls
          state="paused"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
        />
      );

      const resumeButton = screen.getByRole('button', { name: /resume/i });
      expect(resumeButton).toBeInTheDocument();
      expect(resumeButton).toHaveTextContent('Resume');
      expect(resumeButton).not.toBeDisabled();
    });

    it('should be disabled during active recording', () => {
      render(
        <RecordingControls
          state="recording"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
        />
      );

      const startButton = screen.getByRole('button', { name: /start/i });
      expect(startButton).toBeDisabled();
    });
  });

  describe('Pause button', () => {
    it('should be enabled only when state is recording', async () => {
      const onPause = vi.fn();
      render(
        <RecordingControls
          state="recording"
          onStart={vi.fn()}
          onPause={onPause}
          onStop={vi.fn()}
        />
      );

      const pauseButton = screen.getByRole('button', { name: /pause/i });
      expect(pauseButton).not.toBeDisabled();

      await userEvent.click(pauseButton);
      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it('should be disabled in idle, paused, or stopped states', () => {
      const { rerender } = render(
        <RecordingControls
          state="idle"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /pause/i })).toBeDisabled();

      rerender(
        <RecordingControls
          state="paused"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /pause/i })).toBeDisabled();

      rerender(
        <RecordingControls
          state="stopped"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /pause/i })).toBeDisabled();
    });
  });

  describe('Stop button', () => {
    it('should be enabled when recording or paused and call onStop when clicked', async () => {
      const onStop = vi.fn();
      const { rerender } = render(
        <RecordingControls
          state="recording"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onStop={onStop}
        />
      );

      const stopButton = screen.getByRole('button', { name: /stop/i });
      expect(stopButton).not.toBeDisabled();

      await userEvent.click(stopButton);
      expect(onStop).toHaveBeenCalledTimes(1);

      rerender(
        <RecordingControls
          state="paused"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onStop={onStop}
        />
      );
      expect(screen.getByRole('button', { name: /stop/i })).not.toBeDisabled();
    });

    it('should be disabled in idle state', () => {
      render(
        <RecordingControls
          state="idle"
          onStart={vi.fn()}
          onPause={vi.fn()}
          onStop={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /stop/i })).toBeDisabled();
    });
  });
});

describe('RecordingIndicator', () => {
  it('should show pulsing red dot during active recording', () => {
    render(<RecordingIndicator state="recording" />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-label', 'Recording in progress');

    const dot = status.querySelector('span');
    expect(dot).toHaveClass('bg-red-500');
    expect(dot).toHaveClass('animate-pulse-recording');
  });

  it('should show pulsing amber dot with "PAUSED" label during paused state', () => {
    render(<RecordingIndicator state="paused" />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-label', 'Recording paused');

    const dot = status.querySelector('span:first-child');
    expect(dot).toHaveClass('bg-amber-500');
    expect(dot).toHaveClass('animate-pulse-paused');

    expect(screen.getByText('PAUSED')).toBeInTheDocument();
  });

  it('should be hidden when idle or stopped', () => {
    const { rerender, container } = render(<RecordingIndicator state="idle" />);
    expect(container.firstChild).toBeNull();

    rerender(<RecordingIndicator state="stopped" />);
    expect(container.firstChild).toBeNull();
  });
});
