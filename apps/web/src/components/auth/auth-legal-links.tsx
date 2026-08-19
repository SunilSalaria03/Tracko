import Link from "next/link";

export function AuthLegalLinks() {
  return (
    <p className="text-center text-[13px]">
      <span className="cursor-not-allowed text-[#8a8a8a]">Forgot password?</span>
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
