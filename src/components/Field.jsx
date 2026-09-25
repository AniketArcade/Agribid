/** Label + control + optional hint. Pass `as="select"` / `as="textarea"` for other controls. */
export default function Field({ label, hint, as: Tag = 'input', children, className = '', ...props }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      <Tag {...props}>{children}</Tag>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
