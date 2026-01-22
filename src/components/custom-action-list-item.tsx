'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CustomAction } from '@/types';

export interface CustomActionListItemProps {
  /** The custom action to display */
  action: CustomAction;
  /** Callback when delete is confirmed */
  onDelete: (id: string) => void;
}

/**
 * Displays a single custom action with name, URL, and delete button.
 * Includes inline confirmation before deletion.
 */
export function CustomActionListItem({ action, onDelete }: CustomActionListItemProps) {
  const [showConfirm, setShowConfirm] = React.useState(false);

  /**
   * Handle delete button click - show confirmation
   */
  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  /**
   * Handle confirm delete
   */
  const handleConfirmDelete = () => {
    onDelete(action.id);
    setShowConfirm(false);
  };

  /**
   * Handle cancel delete
   */
  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 p-2 border rounded-md bg-white dark:bg-zinc-950">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{action.name}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{action.url}</p>
      </div>

      {showConfirm ? (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirmDelete}
            aria-label={`Confirm delete ${action.name}`}
          >
            Delete
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancelDelete}
            aria-label="Cancel delete"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDeleteClick}
          aria-label={`Delete ${action.name}`}
          title={`Delete ${action.name}`}
        >
          <Trash2 className="h-4 w-4 text-zinc-500 hover:text-red-500" />
        </Button>
      )}
    </div>
  );
}
