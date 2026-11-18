import { ForgotPasswordForm } from "@/features/auth";

export const metadata = {
  title: "Forgot Password — IntelliClass AI",
  description: "Reset your IntelliClass account credentials securely.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-300">
      <ForgotPasswordForm />
    </div>
  );
}
