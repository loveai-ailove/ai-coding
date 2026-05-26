"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { SidebarMenuItem } from "@/types/system";

function SidebarNode({ item, pathname, onClick }: { item: SidebarMenuItem; pathname: string; onClick?: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;

  const isActive = item.path
    ? item.path === "/admin"
      ? pathname === "/admin"
      : pathname === item.path || pathname.startsWith(`${item.path}/`)
    : false;

  return (
    <div className="space-y-1">
      {item.path ? (
        <div className="flex items-center">
          <Link
            href={item.path}
            onClick={onClick}
            className={`block flex-1 rounded-lg px-3 py-2 text-sm transition ${
              isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item.name}
          </Link>
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setExpanded((v) => !v);
              }}
              className="ml-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label={expanded ? "收起" : "展开"}
            >
              <svg
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
          className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
        >
          <svg
            className={`mr-1.5 h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
          </svg>
          <span className="flex-1">{item.name}</span>
        </div>
      )}

      {hasChildren && expanded ? (
        <div className="space-y-1 border-l border-gray-200 pl-3">
          {item.children.map((child) => (
            <SidebarNode key={child.id} item={child} pathname={pathname} onClick={onClick} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminSidebar({
  menus,
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  menus: SidebarMenuItem[];
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const collapseToggle = (
    <button
      type="button"
      onClick={onToggleCollapse}
      className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
    >
      <svg className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
      </svg>
    </button>
  );

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-6 py-5">
        <Link href="/admin" className="text-lg font-semibold text-gray-900" onClick={onClose}>
          Admin System
        </Link>
        <div className="flex items-center gap-1">
          {collapseToggle}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
            aria-label="关闭菜单"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {menus.map((menu) => (
          <SidebarNode key={menu.id} item={menu} pathname={pathname} onClick={onClose} />
        ))}
      </div>
    </>
  );

  return (
    <>
      <aside className={`hidden shrink-0 border-r border-gray-200 bg-gray-50 lg:flex lg:flex-col transition-all duration-300 ${collapsed ? "w-12" : "w-56"}`}>
        {collapsed ? (
          <div className="flex h-full flex-col items-center py-5">
            {collapseToggle}
          </div>
        ) : (
          sidebarContent
        )}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={onClose}
          />
          <aside className="absolute left-0 top-0 z-50 flex h-full w-64 flex-col bg-gray-50 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
