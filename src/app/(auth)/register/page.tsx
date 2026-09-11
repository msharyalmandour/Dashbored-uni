import { pageTitle } from "@/lib/i18n/page-title";
import { RegisterForm } from "@/components/auth/register-form";

export const generateMetadata = pageTitle((dict) => dict.auth.signUp);

export default function RegisterPage() {
  return <RegisterForm />;
}
