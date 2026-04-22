import { useRef, useState } from 'react';
import { exportData, importData, type DataImportResult } from '../api';

interface DataAdminPageProps {
  onClose: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export function DataAdminPage({ onClose }: DataAdminPageProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setStatus({ kind: 'busy', message: 'Exporting…' });
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incrementallist-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: 'success', message: 'Export downloaded.' });
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) });
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected
    e.target.value = '';

    setStatus({ kind: 'busy', message: `Reading ${file.name}…` });
    try {
      const text = await file.text();
      const data = JSON.parse(text) as object;
      setStatus({ kind: 'busy', message: 'Importing…' });
      const result: DataImportResult = await importData(data);
      setStatus({
        kind: 'success',
        message: [
          `Import complete.`,
          `Activities created: ${result.activities_created}`,
          `Activities updated: ${result.activities_updated}`,
          `Occurrences added: ${result.occurances_added}`,
          `Game state updated: ${result.game_state_updated ? 'yes' : 'no'}`,
        ].join('  •  '),
      });
    } catch (err) {
      setStatus({ kind: 'error', message: `Import failed: ${String(err)}` });
    }
  }

  const statusColor: Record<Status['kind'], string> = {
    idle: 'transparent',
    busy: '#6c757d',
    success: '#198754',
    error: '#dc3545',
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>Data Administration</h2>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>
          ← Back
        </button>
      </div>

      <div className="admin-section">
        <h3>Export</h3>
        <p className="admin-description">
          Download all your activities, occurrences, and game state as a JSON file.
        </p>
        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={status.kind === 'busy'}
        >
          Download Export
        </button>
      </div>

      <div className="admin-section">
        <h3>Import</h3>
        <p className="admin-description">
          Upload a previously-exported JSON file to restore data. Existing activities
          are updated by title; duplicate occurrences (same start time) are skipped.
        </p>
        <button
          className="btn btn-success"
          onClick={handleImportClick}
          disabled={status.kind === 'busy'}
        >
          Choose File & Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {status.kind !== 'idle' && (
        <div
          className="admin-status"
          style={{ borderColor: statusColor[status.kind], color: statusColor[status.kind] }}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
