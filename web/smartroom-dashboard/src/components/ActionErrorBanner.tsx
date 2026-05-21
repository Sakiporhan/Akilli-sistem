type Props = {
  message: string | null;
};

export function ActionErrorBanner({ message }: Props) {
  if (!message) return null;

  return (
    <div className="rounded-xl border border-amber-500/35 bg-amber-950/35 px-4 py-3 text-sm text-amber-100">
      <span className="font-semibold text-amber-200">Kontrol isteği:</span> {message}
    </div>
  );
}
