import Link from "next/link";

export function AuthLegalLinks() {
  return (
    <p className="text-center text-[13px]">
      <Link href="/forgot-password" className="text-[#8a8a8a] hover:underline">
        Forgot password?
      </Link>
      <span className="mx-3 text-[#c8c8c8]">·</span>
      <Link href="#" className="text-[#8a8a8a] hover:underline">
        Terms of service
      </Link>
      <span className="mx-3 text-[#c8c8c8]">·</span>
      <Link href="#" className="text-[#8a8a8a] hover:underline">
        Privacy policy
      </Link>
    </p>
  );
}
