import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "姓名和邮箱不能为空" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: { name, email },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message.includes("Unique")
        ? "该邮箱已存在"
        : "创建用户失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
