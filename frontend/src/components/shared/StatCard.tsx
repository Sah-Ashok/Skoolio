export type StatCardProps = {
  label: string;
  value: string | number;
  helperText?: string;
};

export default function StatCard({ label, value, helperText }: StatCardProps) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      {helperText ? <small>{helperText}</small> : null}
    </article>
  );
}
