export function ProviderSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: Array<{ id: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        className="field-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
