import { bootstrapSystem } from "@/lib/system/bootstrap";
import { extendMenus } from "@/lib/system/extend-menus";
import { handleApiError } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    let bootstrapResult: Awaited<ReturnType<typeof bootstrapSystem>> | null = null;

    try {
      bootstrapResult = await bootstrapSystem();
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "CONFLICT") {
        throw error;
      }
    }

    const menuResult = await extendMenus();

    return NextResponse.json(
      {
        message: bootstrapResult
          ? "系统初始化成功，并已补齐知识库与工作流菜单"
          : menuResult.created
            ? "系统已初始化，已补齐知识库与工作流菜单"
            : "系统已初始化，知识库与工作流菜单已存在",
        bootstrap: bootstrapResult,
        menus: menuResult,
      },
      { status: bootstrapResult ? 201 : 200 }
    );
  } catch (error) {
    return handleApiError(error, "系统初始化失败");
  }
}
