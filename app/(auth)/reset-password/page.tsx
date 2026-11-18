import { ResetPasswordForm } from "@/features/auth";

export const metadata = {
  title: "Set New Password — IntelliClass AI",
  description: "Update and secure your IntelliClass account credentials.",
};

export default function ResetPasswordPage() {
  return (
    <div className="w-full animate-in fade-in zoom-in-95 duration-300">
      <ResetPasswordForm />
    </div>
  );
}
