// TODO: Integrate with real email verification endpoint
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-xl font-semibold text-foreground">Verify your email</h2>
      <p className="text-sm text-muted-foreground">
        We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
      </p>
      <Button variant="outline" asChild>
        <Link to="/login">Back to login</Link>
      </Button>
    </div>
  );
}
