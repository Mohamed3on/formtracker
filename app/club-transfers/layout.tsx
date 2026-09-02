export default function ClubTransfersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="font-pixel mb-1 text-2xl text-text-primary sm:mb-2 sm:text-3xl">
          Club Transfers
        </h1>
        <p className="max-w-xl text-sm text-text-muted sm:text-base">
          Who spent, who sold, who bought well and who came out ahead — every club in the window.
        </p>
      </div>
      {children}
    </div>
  );
}
