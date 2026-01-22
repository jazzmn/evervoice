'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface CustomActionFormProps {
  /** Callback when a new action is submitted */
  onSubmit: (name: string, url: string) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
}

/**
 * Validates that a URL starts with http:// or https://
 */
function isValidUrl(url: string): boolean {
  const trimmedUrl = url.trim();
  return trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');
}

/**
 * Inline form for adding a new custom action.
 * Includes URL validation to ensure URLs start with http:// or https://.
 */
export function CustomActionForm({ onSubmit, onCancel }: CustomActionFormProps) {
  const [name, setName] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [urlError, setUrlError] = React.useState<string | null>(null);

  /**
   * Handle form submission with validation
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    // Validate name is not empty
    if (!trimmedName) {
      return;
    }

    // Validate URL format
    if (!isValidUrl(trimmedUrl)) {
      setUrlError('URL must start with http:// or https://');
      return;
    }

    // Clear error and submit
    setUrlError(null);
    onSubmit(trimmedName, trimmedUrl);

    // Clear form after successful save
    setName('');
    setUrl('');
  };

  /**
   * Handle URL input change
   */
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    // Clear error when user starts typing
    if (urlError) {
      setUrlError(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 border rounded-md bg-zinc-50 dark:bg-zinc-900">
      <div className="grid gap-2">
        <Label htmlFor="action-name">Action Name</Label>
        <Input
          id="action-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Action"
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="action-url">URL</Label>
        <Input
          id="action-url"
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder="https://api.example.com/endpoint"
          aria-describedby={urlError ? 'url-error' : undefined}
          aria-invalid={urlError ? 'true' : undefined}
          required
        />
        {urlError && (
          <p
            id="url-error"
            className="text-sm text-red-500 dark:text-red-400"
            role="alert"
          >
            {urlError}
          </p>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Action
        </Button>
      </div>
    </form>
  );
}
