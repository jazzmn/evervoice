'use client';

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './button';

describe('Button Component Styling', () => {
  it('renders default variant with dark-first classes', () => {
    const { getByRole } = render(<Button>Default Button</Button>);
    const button = getByRole('button');
    expect(button).toHaveClass('bg-zinc-50');
    expect(button).toHaveClass('text-zinc-900');
    expect(button).toHaveClass('shadow');
  });

  it('has transition and transform classes for hover effects', () => {
    const { getByRole } = render(<Button>Hover Button</Button>);
    const button = getByRole('button');
    expect(button).toHaveClass('transition-all');
    expect(button).toHaveClass('duration-300');
    expect(button).toHaveClass('hover:-translate-y-0.5');
  });

  it('renders outline variant with visible border on dark background', () => {
    const { getByRole } = render(<Button variant="outline">Outline Button</Button>);
    const button = getByRole('button');
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('border-zinc-700');
    expect(button).toHaveClass('bg-transparent');
    expect(button).toHaveClass('text-zinc-50');
  });

  it('has light focus ring for visibility on dark backgrounds', () => {
    const { getByRole } = render(<Button>Focus Button</Button>);
    const button = getByRole('button');
    expect(button).toHaveClass('focus-visible:ring-zinc-300');
  });
});
