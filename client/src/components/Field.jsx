export default function Field({label, hint, error, children, htmlFor}) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {hint ? <small className="muted">{hint}</small> : null}
      {error ? <span className="form-error">{error}</span> : null}
    </label>
  );
}
