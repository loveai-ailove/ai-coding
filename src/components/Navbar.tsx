import Link from "next/link";

export function Navbar() {
  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link href="/" className="font-bold text-lg">
          AI Coding
        </Link>
        <Link href="/users" className="hover:text-gray-300">
          用户管理
        </Link>
      </div>
    </nav>
  );
}
