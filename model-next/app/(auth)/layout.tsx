import { Navbar } from "@/components/shared";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] dark:bg-black text-[#1d1d1f] dark:text-[#f5f5f7] antialiased transition-colors duration-200">
      <Navbar showLinks={false} />
      <main className="flex-1 w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-10 2xl:px-20 2xl:py-12">
        <div className="w-full max-w-md lg:max-w-6xl 2xl:max-w-7xl my-auto">
          {children}
        </div>
      </main>
      <footer className="hidden lg:block py-4 text-center text-xs text-[#86868b] dark:text-[#86868b] border-t border-[#e5e5ea] dark:border-[#2c2c2e] shrink-0 transition-colors duration-200">
        IntelliClass AI &bull; Secure Institutional Authentication
      </footer>
    </div>
  );
}
