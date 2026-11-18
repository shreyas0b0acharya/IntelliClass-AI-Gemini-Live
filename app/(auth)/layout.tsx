import { Navbar } from "@/components/shared";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted dark:bg-black text-foreground dark:text-foreground antialiased transition-colors duration-200">
      <Navbar showLinks={false} />
      <main className="flex-1 w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-10 2xl:px-20 2xl:py-12">
        <div className="w-full max-w-md lg:max-w-6xl 2xl:max-w-7xl my-auto">
          {children}
        </div>
      </main>
      <footer className="hidden lg:block py-4 text-center text-xs text-muted-foreground dark:text-muted-foreground border-t border-border dark:border-border shrink-0 transition-colors duration-200">
        IntelliClass AI &bull; Secure Institutional Authentication
      </footer>
    </div>
  );
}
