interface HeaderProps {
  onAddClick: () => void;
}

export function Header({ onAddClick }: HeaderProps) {
  return (
    <div className="header">
      <h1>⏱️ Do Again List</h1>
      <button className="btn btn-primary" onClick={onAddClick}>
        + Add Event
      </button>
    </div>
  );
}
