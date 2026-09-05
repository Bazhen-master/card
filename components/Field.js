export default function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}
