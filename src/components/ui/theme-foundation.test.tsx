'use client';

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Test component that simulates dark mode container
function DarkModeContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-background text-foreground" data-testid="dark-container">
      {children}
    </div>
  );
}

describe('Theme Foundation', () => {
  it('renders dark mode class on container element', () => {
    const { getByTestId } = render(
      <DarkModeContainer>
        <span>Test Content</span>
      </DarkModeContainer>
    );
    const container = getByTestId('dark-container');
    expect(container).toHaveClass('dark');
  });

  it('applies background and foreground CSS classes', () => {
    const { getByTestId } = render(
      <DarkModeContainer>
        <span>Test Content</span>
      </DarkModeContainer>
    );
    const container = getByTestId('dark-container');
    expect(container).toHaveClass('bg-background');
    expect(container).toHaveClass('text-foreground');
  });

  it('renders content correctly within dark mode container', () => {
    const { getByText } = render(
      <DarkModeContainer>
        <span>Dark Mode Content</span>
      </DarkModeContainer>
    );
    expect(getByText('Dark Mode Content')).toBeInTheDocument();
  });
});
