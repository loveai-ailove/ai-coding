import Link from "next/link";

export default function HomePage() {
  return (
    <div className="text-center py-20">
      <h1 className="text-4xl font-bold mb-4">AI Coding App</h1>
      <p className="text-gray-600 mb-8 text-lg">
        全栈应用
      </p>
      <div className="flex justify-center gap-4">
        <Link
          href="/users"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
        >
          用户管理
        </Link>
      </div>
      <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto text-left">
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="font-semibold mb-1">Next.js 16</h3>
          <p className="text-sm text-gray-500">Turbopack · Cache Components · React 19.2</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="font-semibold mb-1">Prisma 7</h3>
          <p className="text-sm text-gray-500">Rust-free Client · TypeScript-only · Driver Adapter</p>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="font-semibold mb-1">MySQL 8.4</h3>
          <p className="text-sm text-gray-500">Docker 部署 · 端口 3306</p>
        </div>
      </div>
    </div>
  );
}
