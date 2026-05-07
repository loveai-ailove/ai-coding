import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "获取用户失败" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "姓名和邮箱不能为空" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { name, email },
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message.includes("Unique")
        ? "该邮箱已存在"
        : "更新用户失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.user.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch {
    return NextResponse.json({ error: "删除用户失败" }, { status: 400 });
  }
}
