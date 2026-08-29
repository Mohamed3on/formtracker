export default function FeeVsValueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-pixel mb-1 sm:mb-2 text-text-primary">
          Fee vs Value
        </h1>
        <p className="text-sm sm:text-base text-text-muted max-w-2xl">
          The biggest transfers of the season. For each one we put the fee next to what the player
          was worth. Who paid too much, and who got a bargain.
        </p>
      </div>
      {children}
    </div>
  );
}
