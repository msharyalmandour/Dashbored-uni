import { pageTitle } from "@/lib/i18n/page-title";
import { LoginForm } from "@/components/auth/login-form";

export const generateMetadata = pageTitle((dict) => dict.auth.signIn);

export default function LoginPage() {
  return <LoginForm />;
}
