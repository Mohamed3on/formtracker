export default function TransferBalanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="font-pixel mb-1 text-2xl text-text-primary sm:mb-2 sm:text-3xl">
          Transfer Balance
        </h1>
        <p className="max-w-xl text-sm text-text-muted sm:text-base">
          Who spent, who sold, and who came out ahead — across every club on Transfermarkt.
        </p>
      </div>
      {children}
    </div>
  );
}
