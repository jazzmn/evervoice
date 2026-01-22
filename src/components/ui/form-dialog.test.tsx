'use client';

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Input } from './input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from './dialog';

describe('Input Component Styling', () => {
  it('renders with visible border on dark background', () => {
    const { getByRole } = render(<Input placeholder="Test input" />);
    const input = getByRole('textbox');
    expect(input).toHaveClass('border-zinc-700');
  });

  it('has dark-first background and text colors', () => {
    const { getByRole } = render(<Input placeholder="Test input" />);
    const input = getByRole('textbox');
    expect(input).toHaveClass('bg-zinc-900');
    expect(input).toHaveClass('text-zinc-50');
  });

  it('has light focus ring for accessibility', () => {
    const { getByRole } = render(<Input placeholder="Test input" />);
    const input = getByRole('textbox');
    expect(input).toHaveClass('focus-visible:ring-zinc-300');
  });
});

describe('Dialog Component Styling', () => {
  it('renders DialogContent with dark background', () => {
    const { getByRole } = render(
      <Dialog open>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
    const dialog = getByRole('dialog');
    expect(dialog).toHaveClass('bg-zinc-950');
    expect(dialog).toHaveClass('border-zinc-800');
  });

  it('renders DialogDescription with muted text color', () => {
    const { getByText } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>Dialog description text</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
    const description = getByText('Dialog description text');
    expect(description).toHaveClass('text-zinc-400');
  });
});
