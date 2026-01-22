import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HotkeyInput } from './hotkey-input';
import { DEFAULT_GLOBAL_HOTKEY } from '@/types';

describe('HotkeyInput', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render current hotkey value', () => {
    render(<HotkeyInput value="Ctrl+Shift+R" onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('Ctrl+Shift+R')).toBeInTheDocument();
  });

  it('should enter capture mode when Change button is clicked', async () => {
    const user = userEvent.setup();
    render(<HotkeyInput value="Ctrl+Shift+R" onChange={mockOnChange} />);

    const changeButton = screen.getByRole('button', { name: /record new hotkey/i });
    await user.click(changeButton);

    expect(screen.getByDisplayValue(/press a key combination/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should capture a valid hotkey combination', async () => {
    const user = userEvent.setup();
    render(<HotkeyInput value="Ctrl+Shift+R" onChange={mockOnChange} />);

    // Enter capture mode
    const changeButton = screen.getByRole('button', { name: /record new hotkey/i });
    await user.click(changeButton);

    // Capture a new hotkey
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'S', ctrlKey: true, altKey: true });

    expect(mockOnChange).toHaveBeenCalledWith('Ctrl+Alt+S');
  });

  it('should show error when no modifier is used', async () => {
    const user = userEvent.setup();
    render(<HotkeyInput value="Ctrl+Shift+R" onChange={mockOnChange} />);

    // Enter capture mode
    const changeButton = screen.getByRole('button', { name: /record new hotkey/i });
    await user.click(changeButton);

    // Try to capture a key without modifiers
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'R' });

    expect(screen.getByText(/must include at least one modifier/i)).toBeInTheDocument();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should reset to default hotkey', async () => {
    const user = userEvent.setup();
    render(<HotkeyInput value="Alt+R" onChange={mockOnChange} />);

    const resetButton = screen.getByRole('button', { name: /reset hotkey to default/i });
    await user.click(resetButton);

    expect(mockOnChange).toHaveBeenCalledWith(DEFAULT_GLOBAL_HOTKEY);
  });

  it('should disable reset button when value is already default', () => {
    render(<HotkeyInput value={DEFAULT_GLOBAL_HOTKEY} onChange={mockOnChange} />);

    const resetButton = screen.getByRole('button', { name: /reset hotkey to default/i });
    expect(resetButton).toBeDisabled();
  });

  it('should display error from props', () => {
    render(
      <HotkeyInput
        value="Ctrl+Shift+R"
        onChange={mockOnChange}
        error="This hotkey conflicts with another application"
      />
    );

    expect(screen.getByText(/conflicts with another application/i)).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<HotkeyInput value="Ctrl+Shift+R" onChange={mockOnChange} disabled />);

    const changeButton = screen.getByRole('button', { name: /record new hotkey/i });
    expect(changeButton).toBeDisabled();

    const resetButton = screen.getByRole('button', { name: /reset hotkey to default/i });
    expect(resetButton).toBeDisabled();

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});
