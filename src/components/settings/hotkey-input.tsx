'use client';

import * as React from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_GLOBAL_HOTKEY } from '@/types';

interface HotkeyInputProps {
  /** Current hotkey value */
  value: string;
  /** Callback when hotkey changes */
  onChange: (hotkey: string) => void;
  /** Error message to display */
  error?: string | null;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** ID for the input element */
  id?: string;
}

/**
 * Valid modifier keys that can be used in hotkey combinations
 */
const VALID_MODIFIERS = ['Control', 'Alt', 'Shift', 'Meta'] as const;

/**
 * Map browser key names to our standard format
 */
const KEY_NAME_MAP: Record<string, string> = {
  Control: 'Ctrl',
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};

/**
 * Format a key name for display
 */
function formatKeyName(key: string): string {
  return KEY_NAME_MAP[key] || key;
}

/**
 * Build hotkey string from modifiers and key
 */
function buildHotkeyString(modifiers: Set<string>, key: string): string {
  const parts: string[] = [];

  // Add modifiers in consistent order
  if (modifiers.has('Control')) parts.push('Ctrl');
  if (modifiers.has('Alt')) parts.push('Alt');
  if (modifiers.has('Shift')) parts.push('Shift');
  if (modifiers.has('Meta')) parts.push('Meta');

  // Add the key
  parts.push(formatKeyName(key));

  return parts.join('+');
}

/**
 * Check if a key is a modifier key
 */
function isModifierKey(key: string): boolean {
  return VALID_MODIFIERS.includes(key as typeof VALID_MODIFIERS[number]);
}

/**
 * HotkeyInput component for capturing keyboard shortcuts.
 *
 * Features:
 * - Capture mode for recording new hotkeys
 * - Validates that at least one modifier is used
 * - Displays current hotkey in a readable format
 * - Reset to default functionality
 */
export function HotkeyInput({
  value,
  onChange,
  error,
  disabled = false,
  id = 'hotkey-input',
}: HotkeyInputProps) {
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [capturedModifiers, setCapturedModifiers] = React.useState<Set<string>>(new Set());
  const [localError, setLocalError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Display error from props or local validation
  const displayError = error || localError;

  /**
   * Handle entering capture mode
   */
  const startCapture = () => {
    if (disabled) return;
    setIsCapturing(true);
    setLocalError(null);
    setCapturedModifiers(new Set());
    // Focus the input so keydown events are captured
    inputRef.current?.focus();
  };

  /**
   * Handle exiting capture mode
   */
  const stopCapture = () => {
    setIsCapturing(false);
    setCapturedModifiers(new Set());
  };

  /**
   * Handle keydown events during capture mode
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isCapturing) return;

    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();

    const key = event.key;

    // Track modifier keys
    const newModifiers = new Set(capturedModifiers);
    if (event.ctrlKey) newModifiers.add('Control');
    if (event.altKey) newModifiers.add('Alt');
    if (event.shiftKey) newModifiers.add('Shift');
    if (event.metaKey) newModifiers.add('Meta');

    setCapturedModifiers(newModifiers);

    // If it's just a modifier key, wait for the main key
    if (isModifierKey(key)) {
      return;
    }

    // Validate that at least one modifier is pressed
    if (newModifiers.size === 0) {
      setLocalError('Hotkey must include at least one modifier (Ctrl, Alt, Shift, or Meta)');
      return;
    }

    // Build and set the hotkey
    const hotkey = buildHotkeyString(newModifiers, key);
    setLocalError(null);
    onChange(hotkey);
    stopCapture();
  };

  /**
   * Handle keyup events to track modifier releases
   */
  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isCapturing) return;

    // Update modifier state
    const newModifiers = new Set(capturedModifiers);
    if (!event.ctrlKey) newModifiers.delete('Control');
    if (!event.altKey) newModifiers.delete('Alt');
    if (!event.shiftKey) newModifiers.delete('Shift');
    if (!event.metaKey) newModifiers.delete('Meta');

    setCapturedModifiers(newModifiers);
  };

  /**
   * Handle blur to exit capture mode
   */
  const handleBlur = () => {
    if (isCapturing) {
      stopCapture();
    }
  };

  /**
   * Reset to default hotkey
   */
  const handleReset = () => {
    setLocalError(null);
    onChange(DEFAULT_GLOBAL_HOTKEY);
  };

  /**
   * Get display value for the input
   */
  const getDisplayValue = (): string => {
    if (isCapturing) {
      if (capturedModifiers.size > 0) {
        const parts: string[] = [];
        if (capturedModifiers.has('Control')) parts.push('Ctrl');
        if (capturedModifiers.has('Alt')) parts.push('Alt');
        if (capturedModifiers.has('Shift')) parts.push('Shift');
        if (capturedModifiers.has('Meta')) parts.push('Meta');
        return parts.join('+') + '+...';
      }
      return 'Press a key combination...';
    }
    return value;
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Global Hotkey</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            id={id}
            type="text"
            value={getDisplayValue()}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={handleBlur}
            onFocus={() => isCapturing && inputRef.current?.focus()}
            readOnly
            disabled={disabled}
            className={`pr-10 ${isCapturing ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            aria-describedby={displayError ? 'hotkey-error' : 'hotkey-description'}
            aria-invalid={!!displayError}
            aria-label="Global hotkey binding"
          />
          <Keyboard
            className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
              isCapturing ? 'text-blue-500' : 'text-zinc-400'
            }`}
          />
        </div>
        <Button
          type="button"
          variant={isCapturing ? 'default' : 'outline'}
          size="sm"
          onClick={isCapturing ? stopCapture : startCapture}
          disabled={disabled}
          aria-label={isCapturing ? 'Cancel hotkey capture' : 'Record new hotkey'}
        >
          {isCapturing ? 'Cancel' : 'Change'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleReset}
          disabled={disabled || value === DEFAULT_GLOBAL_HOTKEY}
          aria-label="Reset hotkey to default"
          title="Reset to default"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      {displayError && (
        <p
          id="hotkey-error"
          className="text-sm text-red-500 dark:text-red-400"
          role="alert"
        >
          {displayError}
        </p>
      )}
      <p
        id="hotkey-description"
        className="text-xs text-zinc-500 dark:text-zinc-400"
      >
        Press this key combination from any application to toggle recording.
        {value !== DEFAULT_GLOBAL_HOTKEY && ` Default: ${DEFAULT_GLOBAL_HOTKEY}`}
      </p>
    </div>
  );
}
