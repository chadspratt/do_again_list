interface HeaderProps {
  onAddClick: () => void;
  sortMode: 'default' | 'due';
  onSortToggle: () => void;
}

export function Header({ onAddClick, sortMode, onSortToggle }: HeaderProps) {
  return (
    <div className="header">
      <h1>⏱️ Do Again List</h1>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className={`btn ${sortMode === 'due' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onSortToggle}
          title={sortMode === 'due' ? 'Currently sorted by due time — click for default' : 'Sort by due time'}
        >
          Sorted By {sortMode === 'due' ? 'Time Till Due' : 'Time Since Last'}
        </button>
        <button className="btn btn-primary" onClick={onAddClick}>
          + Add Event
        </button>
      </div>
    </div>
  );
}
