import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistorySidebar } from './history-sidebar';
import { HistoryItem } from './history-item';
import type { Recording } from '@/types';

/**
 * Test fixtures for history sidebar tests
 */
const mockRecordings: Recording[] = [
  {
    id: 'rec-1',
    filePath: '/path/to/recording1.webm',
    durationSeconds: 125,
    transcription: 'This is a test transcription that is long enough to be truncated when displayed in the history item preview.',
    createdAt: '2024-01-15T10:30:00.000Z',
  },
  {
    id: 'rec-2',
    filePath: '/path/to/recording2.webm',
    durationSeconds: 45,
    transcription: 'Short transcription.',
    createdAt: '2024-01-15T09:00:00.000Z',
  },
  {
    id: 'rec-3',
    filePath: '/path/to/recording3.webm',
    durationSeconds: 300,
    transcription: 'Another recording transcription for testing purposes.',
    createdAt: '2024-01-14T15:45:00.000Z',
  },
];

describe('HistorySidebar', () => {
  describe('rendering recordings list', () => {
    it('should render a list of recordings with timestamps, durations, and previews', () => {
      render(
        <HistorySidebar
          recordings={mockRecordings}
          selectedRecordingId={null}
          isLoading={false}
        />
      );

      // Check sidebar header
      expect(screen.getByText('Recording History')).toBeInTheDocument();

      // Check all recordings are rendered
      const listbox = screen.getByRole('listbox', { name: 'Recordings' });
      const items = within(listbox).getAllByRole('option');
      expect(items).toHaveLength(3);

      // Check first recording shows duration in mm:ss format
      expect(screen.getByText('02:05')).toBeInTheDocument();

      // Check second recording shows duration
      expect(screen.getByText('00:45')).toBeInTheDocument();

      // Check third recording shows duration
      expect(screen.getByText('05:00')).toBeInTheDocument();

      // Check transcription preview is shown (truncated)
      expect(screen.getByText(/Short transcription\./)).toBeInTheDocument();
    });
  });

  describe('selecting a history item', () => {
    it('should call onSelectRecording when clicking a history item', async () => {
      const user = userEvent.setup();
      const onSelectRecording = vi.fn();

      render(
        <HistorySidebar
          recordings={mockRecordings}
          selectedRecordingId={null}
          isLoading={false}
          onSelectRecording={onSelectRecording}
        />
      );

      // Find the second recording item by its text content and click on it
      const shortTranscription = screen.getByText('Short transcription.');
      await user.click(shortTranscription);

      expect(onSelectRecording).toHaveBeenCalledWith('rec-2');
    });

    it('should highlight the selected item visually', () => {
      render(
        <HistorySidebar
          recordings={mockRecordings}
          selectedRecordingId="rec-2"
          isLoading={false}
        />
      );

      const listbox = screen.getByRole('listbox', { name: 'Recordings' });
      const items = within(listbox).getAllByRole('option');

      // Check aria-selected is set correctly
      expect(items[0]).toHaveAttribute('aria-selected', 'false');
      expect(items[1]).toHaveAttribute('aria-selected', 'true');
      expect(items[2]).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('deleting a recording', () => {
    it('should show delete confirmation and call onDeleteRecording when confirmed', async () => {
      const user = userEvent.setup();
      const onDeleteRecording = vi.fn();

      render(
        <HistorySidebar
          recordings={mockRecordings}
          selectedRecordingId={null}
          isLoading={false}
          onDeleteRecording={onDeleteRecording}
        />
      );

      // Find the delete button for the first item (it appears on hover, but is in DOM)
      const deleteButtons = screen.getAllByRole('button', { name: 'Delete recording' });
      expect(deleteButtons.length).toBeGreaterThan(0);

      // Click the first delete button
      await user.click(deleteButtons[0]);

      // Confirmation should appear
      const confirmButton = screen.getByRole('button', { name: 'Confirm delete' });
      expect(confirmButton).toBeInTheDocument();

      // Click confirm
      await user.click(confirmButton);

      expect(onDeleteRecording).toHaveBeenCalledWith('rec-1');
    });
  });

  describe('empty state', () => {
    it('should display helpful message when there are no recordings', () => {
      render(
        <HistorySidebar
          recordings={[]}
          selectedRecordingId={null}
          isLoading={false}
        />
      );

      expect(screen.getByText('No recordings yet')).toBeInTheDocument();
      expect(screen.getByText('Your transcribed recordings will appear here')).toBeInTheDocument();
    });
  });
});

describe('HistoryItem', () => {
  const mockRecording: Recording = {
    id: 'test-rec-1',
    filePath: '/path/to/test.webm',
    durationSeconds: 90,
    transcription: 'This is a test transcription that contains more than eighty characters and should be truncated with an ellipsis at the end.',
    createdAt: '2024-03-20T14:30:00.000Z',
  };

  it('should display timestamp, duration, and truncated transcription preview', () => {
    render(<HistoryItem recording={mockRecording} />);

    // Duration should be formatted as mm:ss
    expect(screen.getByText('01:30')).toBeInTheDocument();

    // Transcription should be truncated at 80 chars with ellipsis
    const previewText = screen.getByText(/This is a test transcription/);
    expect(previewText.textContent).toMatch(/\.\.\.$/);
    expect(previewText.textContent!.length).toBeLessThanOrEqual(83); // 80 chars + "..."
  });

  it('should be keyboard accessible via Enter key', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<HistoryItem recording={mockRecording} onSelect={onSelect} />);

    // Get the clickable item (the div with role="button")
    const items = screen.getAllByRole('button');
    const mainItem = items.find(item => item.getAttribute('aria-selected') !== null);
    expect(mainItem).toBeDefined();

    // Focus and press Enter
    mainItem!.focus();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('test-rec-1');
  });
});
