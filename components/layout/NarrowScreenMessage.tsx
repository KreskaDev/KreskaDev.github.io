// EN copy świadoma deviation od ADR-014 (PL placeholder) per ADR-015 (EN-only chrome).
// ADR-014 immutable Accepted — nie patchujemy, plan v5-02 dokumentuje decyzję.
// PARA Z `hidden md:flex` w app/layout.tsx — zmiana breakpointu wymaga zmiany w OBU
// (md:hidden tutaj + md:flex w RootLayout). Mismatch → albo dwa render naraz, albo nic.
export function NarrowScreenMessage() {
  return (
    <div
      role="alert"
      className="md:hidden fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bg-primary"
    >
      <div className="max-w-sm text-center border border-burgundy/40 bg-burgundy-soft/30 rounded-lg p-6">
        <h2 className="font-display text-2xl text-text-primary mb-3">Open on a larger screen</h2>
        <p className="text-text-secondary text-sm font-sans">
          This site is designed for larger screens. Please open it on a laptop or wider tablet.
        </p>
      </div>
    </div>
  )
}
